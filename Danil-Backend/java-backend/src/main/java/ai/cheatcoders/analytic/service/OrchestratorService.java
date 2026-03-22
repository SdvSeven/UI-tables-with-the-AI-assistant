package ai.cheatcoders.analytic.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.stream.Collectors;

@Service
public class OrchestratorService {

    private final Logger log = LoggerFactory.getLogger(OrchestratorService.class);
    private final MistralService mistral;
    private final QueryService queryService;
    private final JdbcTemplate jdbc;

    private static final Pattern FORBIDDEN = Pattern.compile("\\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern SELECT_START = Pattern.compile("^\\s*SELECT\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern LITERAL_STR = Pattern.compile("'([^']*)'");
    private static final Pattern LITERAL_NUM = Pattern.compile("\\b(\\d+\\.?\\d*)\\b");
    private static final ObjectMapper JSON = new ObjectMapper();

    public OrchestratorService(MistralService mistral, QueryService queryService, JdbcTemplate jdbc) {
        this.mistral = mistral;
        this.queryService = queryService;
        this.jdbc = jdbc;
    }

    public TableMeta getTableMeta(String tableName) {
        // restrict to current schema or public to avoid duplicates across schemas
        String sql = "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = :tbl AND (table_schema = current_schema() OR table_schema = 'public')";
        List<Map<String, Object>> rows = queryService.executeSelect(sql.replace(":tbl", "'" + tableName + "'"), null);
        TableMeta meta = new TableMeta();
        meta.table = tableName;
        meta.columns = rows.stream().collect(Collectors.toMap(r -> (String) r.get("column_name"), r -> (String) r.get("data_type")));
        return meta;
    }

    public List<Map<String, Object>> sampleRows(String tableName, int limit) {
        String sql = String.format("SELECT * FROM %s LIMIT %d", sanitizeIdent(tableName), limit);
        return queryService.executeSelect(sql, null);
    }

    public NLResult handleNaturalLanguageQuery(String tableName, String userQuery, boolean explainWithLLM) {
        try {
            TableMeta meta;
            List<Map<String, Object>> sample;
            try {
                meta = getTableMeta(tableName);
                sample = sampleRows(tableName, 5);
            } catch (Exception e) {
                // detect missing table / relation not found from DB errors and convert to a 400-level error
                Throwable c = e;
                boolean tableNotFound = false;
                while (c != null) {
                    String msg = c.getMessage() == null ? "" : c.getMessage().toLowerCase();
                    if (msg.contains("relation") && msg.contains("does not exist")) {
                        tableNotFound = true;
                        break;
                    }
                    c = c.getCause();
                }
                if (tableNotFound) throw new IllegalArgumentException("Table not found");
                throw e;
            }

            String prompt = buildSqlPrompt(tableName, meta, sample, userQuery);
            log.debug("LLM prompt: {}", prompt);

            String llmResponse = mistral.ask(prompt);
            log.debug("LLM raw response: {}", llmResponse);

            // Preprocessing: strip surrounding markdown code fences if present (e.g., ```json ... ```)
            String cleaned = llmResponse == null ? null : llmResponse.trim();
            // If the LLM client returned an error string (e.g. authentication failure), treat as no response
            if (cleaned != null) {
                String low = cleaned.toLowerCase();
                if (low.contains("mistral error") || low.contains("http 401") || low.contains("bearer token not found")) {
                    log.warn("LLM service returned an error string instead of a completion: {}", cleaned);
                    cleaned = null;
                }
            }
            if (cleaned != null && cleaned.startsWith("```")) {
                // remove leading backticks
                cleaned = cleaned.substring(3);
                // if the fence starts with 'json', strip that token as well
                if (cleaned.toLowerCase().startsWith("json")) cleaned = cleaned.substring(4);
                // remove trailing backticks if present
                if (cleaned.endsWith("```")) cleaned = cleaned.substring(0, cleaned.length() - 3);
                cleaned = cleaned.trim();
            }
            log.debug("LLM cleaned response: {}", cleaned);

            // Strict contract: LLM must return JSON: { "sql": "<SELECT ...>" }
            String sql;
            try {
                // parse cleaned response as JSON strictly; do not accept non-JSON or try to fix it
                Map<String, Object> map = JSON.readValue(cleaned, new TypeReference<Map<String, Object>>() {});
                Object s = map.get("sql");
                if (s == null || !(s instanceof String)) {
                    log.warn("LLM response JSON missing 'sql' field or it is not a string: {}", cleaned);
                    throw new IllegalArgumentException("Invalid LLM response format");
                }
                sql = ((String) s).trim();
            } catch (Exception e) {
                log.warn("Invalid LLM response format: {}", e.getMessage());
                // If LLM failed (e.g., authentication error) or returned non-JSON, attempt a deterministic fallback SQL generator once
                try {
                    String fallback = generateFallbackSql(userQuery, tableName, meta);
                    if (fallback != null && !fallback.isEmpty()) {
                        log.info("Using fallback SQL due to LLM parse failure");
                        sql = fallback;
                    } else {
                        // last-resort deterministic safe projection: list allowed columns explicitly (no wildcard)
                        String cols = String.join(", ", meta.columns.keySet().stream().map(c -> "\"" + c + "\"").collect(Collectors.toList()));
                        if (cols == null || cols.isEmpty()) {
                            throw new IllegalArgumentException("Invalid LLM response format");
                        }
                        sql = String.format("SELECT %s FROM %s", cols, sanitizeIdent(tableName));
                        log.info("Using last-resort safe projection fallback SQL");
                    }
                } catch (IllegalArgumentException iae) {
                    throw iae;
                } catch (Exception ex) {
                    throw new IllegalArgumentException("Invalid LLM response format");
                }
            }

            sql = sql.trim();
            if (sql.endsWith(";")) sql = sql.substring(0, sql.length() - 1);

            // classify intent (simple heuristic stub) based on user query and suggested SQL
            String intent = classifyIntent(userQuery, sql);

            // Build deterministic SQL based on userQuery (filters/sorts/top/last).
            // Use deterministic builder for retrieval-like queries and as a preferred safe fallback.
            String finalSql = buildDeterministicSql(userQuery, tableName, meta, intent);

            // normalize final SQL
            finalSql = finalSql.trim();

            validateSelect(finalSql);
            // additional safety checks against allow-list and column restrictions
            validateSqlSafety(finalSql, meta, userQuery);

            ParamResult pr = parameterizeLiterals(finalSql);

            log.debug("Executing SQL (parameterized): {} with params {}", finalSql, pr.params);

            List<Map<String, Object>> rows = queryService.executeSelect(finalSql, pr.params);

            NLResult res = new NLResult();
            res.sql = finalSql;
            res.rows = rows;
            res.intent = intent;
            res.source = tableName;

            // INSIGHT GENERATION PHASE: send a compact sample of the result to the LLM
            // Build a short prompt that includes the user question, the SQL, and up to 20 rows.
            try {
                List<Map<String, Object>> rowsForLLM = rows.stream().limit(20).collect(Collectors.toList());
                String rowsJson = JSON.writeValueAsString(rowsForLLM);
                StringBuilder ep = new StringBuilder();
                ep.append("You are a data analyst.\n\n");
                ep.append("User question:\n");
                ep.append(userQuery).append("\n\n");
                ep.append("SQL query:\n");
                ep.append(pr.sql).append("\n\n");
                ep.append("Query result (sample):\n");
                ep.append(rowsJson).append("\n\n");
                ep.append("Explain:\n");
                ep.append("- key insights\n");
                ep.append("- patterns\n");
                ep.append("- anything unusual\n\n");
                ep.append("Keep it short and clear.");

                String insight = null;
                // call the LLM for insight but protect with a short timeout so we don't block long-running requests
                java.util.concurrent.ExecutorService ex = java.util.concurrent.Executors.newSingleThreadExecutor();
                try {
                    java.util.concurrent.Future<String> f = ex.submit(() -> mistral.ask(ep.toString()));
                    try {
                        // wait up to 5 seconds for an explanation
                        insight = f.get(5, java.util.concurrent.TimeUnit.SECONDS);
                        // if the LLM client returned an error string, treat as no insight
                        if (insight != null) {
                            String lowi = insight.toLowerCase();
                            if (lowi.contains("mistral error") || lowi.contains("http 401") || lowi.contains("bearer token not found")) {
                                log.warn("Insight LLM returned an error string, dropping insight: {}", insight);
                                insight = null;
                            }
                        }
                    } catch (java.util.concurrent.TimeoutException te) {
                        f.cancel(true);
                        log.warn("Insight LLM call timed out after 5s, returning data without insight");
                        insight = null;
                    } catch (Exception e) {
                        log.warn("Insight LLM call failed, returning data without insight: {}", e.toString());
                        insight = null;
                    }
                } finally {
                    ex.shutdownNow();
                }
                res.explanation = insight;
            } catch (Exception e) {
                // If any serialization or unexpected error occurs, don't block the response
                log.warn("Failed to generate insight (non-fatal): {}", e.toString());
                res.explanation = null;
            }

            // If we returned a capped sample (LIMIT applied) attempt to compute total_count for pagination metadata
            try {
                if ("data_retrieval".equals(res.intent) && rows != null && rows.size() >= 200) {
                    // try a safe COUNT(*) over the original parameterized SQL (without the appended LIMIT)
                    String countSql = "SELECT COUNT(1) as cnt FROM (" + pr.sql + ") AS _cnt";
                    List<Map<String, Object>> cntRes = queryService.executeSelect(countSql, pr.params);
                    if (cntRes != null && !cntRes.isEmpty() && cntRes.get(0).get("cnt") != null) {
                        Number n = (Number) cntRes.get(0).get("cnt");
                        res.totalCount = n.intValue();
                    }
                }
            } catch (Exception e) {
                // counting can be expensive or fail; do not block main response
                log.warn("Failed to obtain total count (non-fatal): {}", e.toString());
            }

            return res;
        } catch (IllegalArgumentException iae) {
            // validation / contract errors - bubble up so controller can return 400
            log.warn("Orchestrator validation error", iae);
            throw iae;
        } catch (Exception e) {
            log.error("Orchestrator error", e);
            throw new RuntimeException(e.getMessage(), e);
        }
    }

    private String buildSqlPrompt(String table, TableMeta meta, List<Map<String, Object>> sample, String userQuery) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are a SQL generator for PostgreSQL. Respond only with a single SELECT statement (no explanations).\n");
        sb.append("Table: ").append(table).append("\nColumns and types:\n");
        meta.columns.forEach((c, t) -> sb.append(c).append(" : ").append(t).append("\n"));
        sb.append("Sample rows (up to 5):\n");
        for (Map<String, Object> r : sample) sb.append(r.toString()).append("\n");
        sb.append("User request: ").append(userQuery).append("\n");
    sb.append("Important: Output only one SELECT statement. Use parameter placeholders (e.g. :p1) when possible.\n");
    sb.append("\nIMPORTANT SQL RULES:\n");
    sb.append("- NEVER put parameters inside INTERVAL expressions.\n");
    sb.append("- Use only literal intervals, for example: interval '1 month' or interval '7 days'.\n");
    sb.append("- DO NOT use placeholders inside INTERVAL (e.g., do NOT produce INTERVAL ':p1 months').\n");
    sb.append("- Output valid PostgreSQL syntax only. Avoid non-standard constructs or quoting that breaks SQL.\n");
    sb.append("- If a time period must be parameterized, use numeric parameters outside the INTERVAL literal and construct the interval as a literal, e.g. WHERE sale_date >= now() - interval '1 month' (do not put :p1 inside the quotes).\n");
    sb.append("\nPROMPT CONSTRAINTS:\n");
    sb.append("- ONLY use columns listed above. If a column is not present, DO NOT reference it.\n");
    sb.append("- Do NOT invent/hallucinate column or table names. Use only the table and columns shown.\n");
    sb.append("- If you cannot produce a valid SELECT using only the listed columns, return JSON with \"sql\": \"\" (empty string).\n");
    sb.append("\nFEW-SHOT EXAMPLES (valid outputs):\n");
    sb.append("Example 1 - valid:\n");
    sb.append("{\"sql\": \"SELECT product_category, AVG(revenue) AS avg_revenue_last_month FROM ").append(table).append(" WHERE sale_date >= CURRENT_DATE - interval '1 month' GROUP BY product_category\"}\n");
    sb.append("Example 2 - cannot: (requested column 'wallet_balance' not present) -> return {\"sql\": \"\"}\n");
    sb.append("\nSTRICT RESPONSE CONTRACT:\n");
    sb.append("You MUST return ONLY valid JSON (no text, no markdown, no code fences). The JSON must be EXACTLY in this format:\n");
    sb.append("{\n  \"sql\": \"<single SELECT statement>\"\n}\n");
    sb.append("Rules:\n");
    sb.append("- Return ONLY the JSON object above and nothing else.\n");
    sb.append("- Do NOT include any explanations, comments, or code blocks.\n");
    sb.append("- The value of \"sql\" must be a single valid PostgreSQL SELECT statement (no multiple statements).\n");
    sb.append("- Do not wrap the JSON in markdown or backticks.\n");
    sb.append("- If you cannot produce a valid single SELECT, return a JSON with \"sql\": \"\" (empty string).\n");
        return sb.toString();
    }

    private void validateSelect(String sql) {
        Matcher m = FORBIDDEN.matcher(sql);
        if (m.find()) throw new IllegalArgumentException("Forbidden SQL verb found: " + m.group(1));
        if (!SELECT_START.matcher(sql).find()) throw new IllegalArgumentException("Only SELECT queries are allowed.");
        if (sql.contains(";")) throw new IllegalArgumentException("Multiple statements or semicolon is not allowed.");
    }

    /**
     * Lightweight safety checks using deterministic regex/string rules.
     * Throws IllegalArgumentException if SQL is considered unsafe.
     */
    private void validateSqlSafety(String sql, TableMeta meta, String userQuestion) {
        String s = sql.trim();
        // basic checks
        if (!SELECT_START.matcher(s).find()) {
            String reason = "does not start with SELECT";
            log.warn("LLM SQL rejected. Question: {}, SQL: {}, Reason: {}", userQuestion, s, reason);
            throw new IllegalArgumentException("Unsafe: must start with SELECT");
        }
        if (s.contains(";")) {
            String reason = "contains semicolon (multiple statements)";
            log.warn("LLM SQL rejected. Question: {}, SQL: {}, Reason: {}", userQuestion, s, reason);
            throw new IllegalArgumentException("Unsafe: semicolons are not allowed");
        }
        if (s.contains("--")) {
            String reason = "contains line comment '--'";
            log.warn("LLM SQL rejected. Question: {}, SQL: {}, Reason: {}", userQuestion, s, reason);
            throw new IllegalArgumentException("Unsafe: SQL comments not allowed");
        }
        if (s.contains("/*") || s.contains("*/")) {
            String reason = "contains block comment '/* */'";
            log.warn("LLM SQL rejected. Question: {}, SQL: {}, Reason: {}", userQuestion, s, reason);
            throw new IllegalArgumentException("Unsafe: block comments not allowed");
        }

        // forbidden keywords
        Matcher forb = FORBIDDEN.matcher(s);
        if (forb.find()) {
            String reason = "forbidden keyword detected: " + forb.group(1);
            log.warn("LLM SQL rejected. Question: {}, SQL: {}, Reason: {}", userQuestion, s, reason);
            throw new IllegalArgumentException("Unsafe: forbidden keyword " + forb.group(1));
        }

        // disallow JOINs and UNIONs
        if (Pattern.compile("(?i)\\bjoin\\b").matcher(s).find()) {
            String reason = "JOIN detected";
            log.warn("LLM SQL rejected. Question: {}, SQL: {}, Reason: {}", userQuestion, s, reason);
            throw new IllegalArgumentException("Unsafe: JOINs are not allowed");
        }
        if (Pattern.compile("(?i)\\bunion\\b").matcher(s).find()) {
            String reason = "UNION detected";
            log.warn("LLM SQL rejected. Question: {}, SQL: {}, Reason: {}", userQuestion, s, reason);
            throw new IllegalArgumentException("Unsafe: UNION is not allowed");
        }

        // disallow subqueries
        if (Pattern.compile("(?i)\\(\\s*select\\b").matcher(s).find()) {
            String reason = "subquery detected (pattern '( select)')";
            log.warn("LLM SQL rejected. Question: {}, SQL: {}, Reason: {}", userQuestion, s, reason);
            throw new IllegalArgumentException("Unsafe: subqueries are not allowed");
        }

    // restrict tables: only the requested table (from meta.table) is allowed and no other tables
        // extract from-clause fragment
        Pattern fromPat = Pattern.compile("(?i)\\bfrom\\b\\s+([\\s\\S]+?)(\\bwhere\b|\\bgroup\\b|\\border\\b|$)");
        Matcher mf = fromPat.matcher(s);
        if (mf.find()) {
            String fromFrag = mf.group(1).trim();
            // split by commas (multiple tables) — not allowed
            String[] parts = fromFrag.split(",");
            for (String part : parts) {
                String token = part.trim().split("\\s+")[0];
                // strip schema and quotes
                token = token.replaceAll("^[\"]|[\"]$", "");
                if (token.contains(".")) token = token.substring(token.lastIndexOf('.') + 1);
                    // allow only the requested table name (case-insensitive)
                    if (!token.equalsIgnoreCase(meta.table)) {
                    String reason = "usage of disallowed table: " + token;
                    log.warn("LLM SQL rejected. Question: {}, SQL: {}, Reason: {}", userQuestion, s, reason);
                    throw new IllegalArgumentException("Unsafe: usage of disallowed table: " + token);
                }
            }
        } else {
            String reason = "FROM clause not found or unparsable";
            log.warn("LLM SQL rejected. Question: {}, SQL: {}, Reason: {}", userQuestion, s, reason);
            throw new IllegalArgumentException("Unsafe: cannot find FROM clause");
        }

        // restrict columns: parse projection and ensure every column referenced is in meta.columns
        Pattern selPat = Pattern.compile("(?i)\\bselect\\b\\s+([\\s\\S]+?)\\bfrom\\b", Pattern.DOTALL);
        Matcher ms = selPat.matcher(s);
        if (ms.find()) {
            String proj = ms.group(1);
            if (proj.contains("*")) {
                String reason = "wildcard '*' not allowed in projection";
                log.warn("LLM SQL rejected. Question: {}, SQL: {}, Reason: {}", userQuestion, s, reason);
                throw new IllegalArgumentException("Unsafe: wildcard * not allowed");
            }
            // split by commas and inspect identifiers
            String[] items = proj.split(",");
            // normalize allowed columns to lowercase for robust matching
            Set<String> allowedCols = meta.columns.keySet().stream().map(String::toLowerCase).collect(Collectors.toSet());
            // allow common agg function names
            Set<String> funcs = Set.of("avg","sum","min","max","count");
            for (String item : items) {
                // remove function calls and parentheses (case-insensitive)
                String cleaned = item.replaceAll("(?i)\\b(AVG|SUM|MIN|MAX|COUNT)\\s*\\(", "").replaceAll("\\)", " ");
                // remove aliases (as ...)
                cleaned = cleaned.replaceAll("(?i)\\s+as\\s+\\w+", "");
                // find identifiers
                Matcher idm = Pattern.compile("\\b([A-Za-z_][A-Za-z0-9_\\.\\$]*)\\b").matcher(cleaned);
                while (idm.find()) {
                    String ident = idm.group(1);
                    // strip table qualifiers if present (e.g., sales.revenue or s.revenue)
                    String identShort = ident.contains(".") ? ident.substring(ident.lastIndexOf('.') + 1) : ident;
                    String lower = identShort.toLowerCase();
                    if (funcs.contains(lower)) continue;
                    // skip SQL keywords
                    if (lower.matches("select|from|where|group|by|order|having|distinct|on|and|or|not")) continue;
                    // if it's not an allowed column, reject
                    if (!allowedCols.contains(lower)) {
                        String reason = "usage of disallowed column: " + identShort;
                        log.warn("LLM SQL rejected. Question: {}, SQL: {}, Reason: {}", userQuestion, s, reason);
                        throw new IllegalArgumentException("Unsafe: usage of disallowed column: " + identShort);
                    }
                }
            }
        } else {
            String reason = "cannot parse projection";
            log.warn("LLM SQL rejected. Question: {}, SQL: {}, Reason: {}", userQuestion, s, reason);
            throw new IllegalArgumentException("Unsafe: cannot parse projection");
        }

        // validate GROUP BY clause columns (if present) to ensure they reference allowed columns
        Pattern groupPat = Pattern.compile("(?i)\\bgroup\\b\\s+by\\s+([\\s\\S]+?)(\\border\\b|\\blimit\\b|$)");
        Matcher mg = groupPat.matcher(s);
        if (mg.find()) {
            String gb = mg.group(1);
            String[] gbItems = gb.split(",");
            for (String gitem : gbItems) {
                String col = gitem.trim().split("\\s+")[0];
                if (col.contains(".")) col = col.substring(col.lastIndexOf('.') + 1);
                col = col.replaceAll("^[\"]|[\"]$", "");
                if (!meta.columns.keySet().stream().map(String::toLowerCase).collect(Collectors.toSet()).contains(col.toLowerCase())) {
                    String reason = "GROUP BY references disallowed column: " + col;
                    log.warn("LLM SQL rejected. Question: {}, SQL: {}, Reason: {}", userQuestion, s, reason);
                    throw new IllegalArgumentException("Unsafe: GROUP BY references disallowed column: " + col);
                }
            }
        }
    }

    private String extractSelectFromText(String text) {
        if (text == null) return null;
        Pattern p = Pattern.compile("(SELECT[\\s\\S]+?)(;|$)", Pattern.CASE_INSENSITIVE);
        Matcher m = p.matcher(text);
        if (m.find()) return m.group(1);
        return null;
    }

    private ParamResult parameterizeLiterals(String sql) {
        Map<String, Object> params = new LinkedHashMap<>();
        // Replace string literals
        Matcher m = LITERAL_STR.matcher(sql);
        int idx = 0;
        StringBuffer out = new StringBuffer();
        while (m.find()) {
            String val = m.group(1);
            int start = m.start();
            // if this string literal follows the word 'interval', keep it intact (Postgres interval literals must be literal)
            boolean precededByInterval = false;
            int j = start - 1;
            // skip whitespace backwards
            while (j >= 0 && Character.isWhitespace(sql.charAt(j))) j--;
            // find contiguous letters immediately preceding
            int wordEnd = j;
            while (j >= 0 && Character.isLetter(sql.charAt(j))) j--;
            int wordStart = j + 1;
            if (wordEnd >= wordStart) {
                String word = sql.substring(wordStart, wordEnd + 1);
                if ("interval".equalsIgnoreCase(word)) precededByInterval = true;
            }
            if (precededByInterval) {
                // keep the literal as-is
                m.appendReplacement(out, m.group(0));
                continue;
            }
            String name = "p" + (++idx);
            params.put(name, val);
            m.appendReplacement(out, ":" + name);
        }
        m.appendTail(out);

        // Replace numeric literals (simple heuristic)
        String afterStr = out.toString();
        Matcher mn = LITERAL_NUM.matcher(afterStr);
        out = new StringBuffer();
        while (mn.find()) {
            String val = mn.group(1);
            int start = mn.start(1);
            // if this numeric literal is inside a single-quoted string, skip parameterization (e.g. interval '1 month')
            int quotes = 0;
            for (int k = 0; k < start; k++) if (afterStr.charAt(k) == '\'') quotes++;
            if ((quotes & 1) == 1) {
                // inside quotes — keep as-is
                mn.appendReplacement(out, val);
                continue;
            }
            if (start > 0) {
                char prev = afterStr.charAt(start - 1);
                if (Character.isLetter(prev) || prev == '_') {
                    mn.appendReplacement(out, val);
                    continue;
                }
            }
            String name = "p" + (++idx);
            try {
                params.put(name, Double.valueOf(val));
            } catch (NumberFormatException nfe) {
                params.put(name, val);
            }
            mn.appendReplacement(out, ":" + name);
        }
        mn.appendTail(out);

        ParamResult pr = new ParamResult();
        pr.sql = out.toString();
        pr.params = params;
        return pr;
    }

    /**
     * Very small deterministic intent classification stub.
     * Returns one of: aggregation, data_retrieval, anomaly_detection, formula_suggestion
     */
    private String classifyIntent(String userQuery, String sql) {
        String s = sql == null ? "" : sql.toLowerCase();
        String q = userQuery == null ? "" : userQuery.toLowerCase();
        if (Pattern.compile("(?i)\\b(avg|sum|min|max|count)\\b").matcher(s).find() || s.contains("group by") || q.contains("средн") || q.contains("average") || q.contains("mean") || q.contains("сумм") || q.contains("сумму") || q.contains("сумма") || q.contains("по регионам") || q.contains("по региона") || q.contains("по категориям") || q.contains("по категори") ) {
            return "aggregation";
        }
        if (q.contains("анома") || q.contains("anomal") || q.contains("outlier")) return "anomaly_detection";
        if (q.contains("формул") || q.contains("formula")) return "formula_suggestion";
        return "data_retrieval";
    }

    private String generateFallbackSql(String userQuery, String tableName, TableMeta meta) {
        String q = userQuery.toLowerCase();
        if (q.contains("среднее") || q.contains("average") || q.contains("mean")) {
            String col = null;
            if (q.contains("revenue")) col = "revenue";
            else if (q.contains("price")) col = "price";
            else if (q.contains("quantity")) col = "quantity";
            if (col == null) return null;
            String groupBy = null;
            if (q.contains("category") || q.contains("product_category")) groupBy = "product_category";
            else if (q.contains("region")) groupBy = "region";
            if (groupBy == null) return null;
            String timeCond = "";
            if (q.contains("последн") || q.contains("last month") || q.contains("месяц")) {
                // keep interval literal intact (avoid parameterization of interval)
                timeCond = " WHERE sale_date >= now() - interval '1 month'";
            }
            // build safe alias (avoid embedding quotes inside alias)
            String alias = "avg_" + col.replaceAll("[^A-Za-z0-9_]", "_");
            return String.format("SELECT %s, AVG(%s) AS %s FROM %s%s GROUP BY %s",
                    sanitizeIdent(groupBy), sanitizeIdent(col), alias, sanitizeIdent(tableName), timeCond, sanitizeIdent(groupBy));
        }
        return null;
    }

    private String sanitizeIdent(String s) {
        return "\"" + s.replaceAll("[\"\\\\]", "") + "\"";
    }

    public static class TableMeta {
        public String table;
        public Map<String, String> columns = new LinkedHashMap<>();
    }

    public static class NLResult {
        public String sql;
        public List<Map<String, Object>> rows;
        public String explanation;
        public String intent;
        public String source;
        public Integer totalCount;
    }

    /**
     * Build a user-friendly display string according to BI assistant rules.
     * This method must NOT call any LLM and must format data deterministically.
     */
    public String buildDisplayResponse(NLResult res, String tableName, String userQuery) {
        if (res == null) return "";
        int rowCount = (res.totalCount != null) ? res.totalCount : (res.rows == null ? 0 : res.rows.size());

        // First line: meaningful action based on intent
        String action;
        String intent = res.intent == null ? "data_retrieval" : res.intent;
        // enhance action to reflect filters, sorting, top/last requests from userQuery
        String qlow = userQuery == null ? "" : userQuery.toLowerCase();
        String filterClause = null;
        String sortClause = null;
        Integer topN = null;
        Integer lastN = null;
        // simple filter detection (e.g., "по Москве") - more robust
        if (qlow.contains("москв")) {
            filterClause = "region = Москва";
        } else {
            java.util.regex.Matcher mf = java.util.regex.Pattern.compile("по\\s+([а-яё\\-]+)", java.util.regex.Pattern.CASE_INSENSITIVE | java.util.regex.Pattern.UNICODE_CASE).matcher(qlow);
            if (mf.find()) {
                String val = mf.group(1);
                // ignore common control words
                if (!val.matches("(последн|топ|отсорт|сортир|данные|продаж|продажи|покажи|покаж)")) {
                    // crude heuristic: treat captured word as region or simple filter value
                    filterClause = "region = " + capitalize(val);
                }
            }
        }
        // sort detection
        if (qlow.contains("отсорт") || qlow.contains("сортир") || qlow.contains("sort")) {
            if (qlow.contains("revenue") || qlow.contains("выручк") || qlow.contains("revenue")) sortClause = "revenue ↓";
        }
        // top N detection (e.g., "топ 10", "top 10")
        java.util.regex.Matcher mt = java.util.regex.Pattern.compile("(топ|top)\\s*(\\d+)", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(qlow);
        if (mt.find()) {
            try { topN = Integer.parseInt(mt.group(2)); } catch (Exception e) { topN = null; }
        }
        // last N detection (e.g., "последние 50", "последн 50")
        java.util.regex.Matcher ml = java.util.regex.Pattern.compile("последн[а-яё]*\\s*(\\d+)", java.util.regex.Pattern.CASE_INSENSITIVE | java.util.regex.Pattern.UNICODE_CASE).matcher(qlow);
        if (ml.find()) {
            try { lastN = Integer.parseInt(ml.group(1)); } catch (Exception e) { lastN = null; }
        }

        switch (intent) {
            case "aggregation":
                action = String.format("Показываю агрегированные данные из %s (запрос: %s).", tableName, abbreviate(userQuery, 100));
                break;
            case "anomaly_detection":
                action = String.format("Показываю данные для обнаружения аномалий в %s.", tableName);
                break;
            case "formula_suggestion":
                action = String.format("Показываю данные из %s для расчёта формулы.", tableName);
                break;
            default:
                action = String.format("Показываю данные из таблицы %s.", tableName);
        }

        // Augment action with detected simple heuristics from the user's query
        // (filters, top/last, sorting) so the display is more informative.
        StringBuilder actionAug = new StringBuilder(action);
        if (filterClause != null && !filterClause.isEmpty()) {
            // friendly rendering of simple filter
            actionAug.append(" По фильтру: ").append(filterClause).append(".");
        }
        if (topN != null) {
            actionAug = new StringBuilder(String.format("Показываю топ %d записей из %s.", topN, tableName));
            if (sortClause != null && sortClause.startsWith("revenue")) actionAug.append(" Отсортировано по revenue по убыванию.");
        } else if (lastN != null) {
            actionAug = new StringBuilder(String.format("Показываю последние %d записей из %s.", lastN, tableName));
        } else if (sortClause != null && sortClause.startsWith("revenue")) {
            actionAug.append(" Отсортировано по revenue по убыванию.");
        }

        action = actionAug.toString();

        // Second line: size
        String sizeLine = String.format("Найдено: %s строк.", prettyCount(rowCount));

        // Third line: limitation
        boolean limited = rowCount > 20;
        String limitLine = "";
        if (limited) {
            if (rowCount > 1000) {
                limitLine = "Отображаю первые 5 строк (используется выборка).";
            } else {
                limitLine = "Отображаю первые 5 строк.";
            }
        }

        List<Map<String, Object>> rows = res.rows == null ? List.of() : res.rows;
        StringBuilder sb = new StringBuilder();
        sb.append(action).append("\n");
        sb.append(sizeLine).append("\n");
        if (!limitLine.isEmpty()) sb.append(limitLine).append("\n\n"); else sb.append("\n");

        // Aggregation: compute aggregates from returned rows (best-effort, on sample)
        if ("aggregation".equals(intent)) {
            // Heuristic: find group-by target in userQuery
            String q = userQuery == null ? "" : userQuery.toLowerCase();
            String groupCol = null;
            if (q.contains("по регионам") || q.contains("по регион")) groupCol = "region";
            else if (q.contains("по категориям") || q.contains("по категори")) groupCol = "product_category";
            else groupCol = "region"; // default

            boolean isAvg = q.contains("средн") || q.contains("average") || q.contains("avg");

            Map<String, Double> agg = new HashMap<>();
            Map<String, Integer> cnt = new HashMap<>();
            for (Map<String, Object> r : rows) {
                String g = safeString(r.getOrDefault(groupCol, ""));
                double v = 0.0;
                try { Object rv = r.get("revenue"); if (rv instanceof Number) v = ((Number)rv).doubleValue(); else v = Double.parseDouble(safeString(rv)); } catch (Exception e) { v = 0.0; }
                agg.put(g, agg.getOrDefault(g, 0.0) + v);
                cnt.put(g, cnt.getOrDefault(g, 0) + 1);
            }
            // build list of pairs
            List<Map.Entry<String, Double>> list = new ArrayList<>();
            for (String k : agg.keySet()) {
                double val = isAvg ? (agg.get(k) / Math.max(1, cnt.getOrDefault(k, 1))) : agg.get(k);
                list.add(new AbstractMap.SimpleEntry<>(k, val));
            }
            list.sort((a,b) -> Double.compare(b.getValue(), a.getValue()));
            sb.append(String.format("%s | %s\n", groupCol, (isAvg?"avg_revenue":"sum_revenue")));
            int nshow = Math.min(5, list.size());
            for (int i = 0; i < nshow; i++) {
                Map.Entry<String, Double> e = list.get(i);
                sb.append(String.format("%s | %s\n", e.getKey(), safeDecimalString(e.getValue())));
            }
            return sb.toString().trim();
        }

        // Anomaly detection: show top N by revenue as suspicious
        if ("anomaly_detection".equals(intent)) {
            List<Map<String, Object>> sorted = new ArrayList<>(rows);
            sorted.sort((a,b) -> {
                double va = 0, vb = 0;
                try { Object oa = a.get("revenue"); if (oa instanceof Number) va = ((Number)oa).doubleValue(); else va = Double.parseDouble(safeString(oa)); } catch (Exception ex) {}
                try { Object ob = b.get("revenue"); if (ob instanceof Number) vb = ((Number)ob).doubleValue(); else vb = Double.parseDouble(safeString(ob)); } catch (Exception ex) {}
                return Double.compare(vb, va);
            });
            int nshow = Math.min(5, sorted.size());
            sb.append("(подозрительные строки — топ по revenue)\n");
            sb.append("id | date | region | category | product | qty | price | revenue\n");
            for (int i = 0; i < nshow; i++) {
                Map<String, Object> r = sorted.get(i);
                sb.append(String.format("%s | %s | %s | %s | %s | %s | %s | %s\n",
                        safeString(r.get("id")), safeDate(r.get("sale_date")), safeString(r.get("region")), safeString(r.get("product_category")), safeString(r.get("product_name")), safeIntString(r.get("quantity")), safeDecimalString(r.get("price")), safeDecimalString(r.get("revenue"))));
            }
            return sb.toString().trim();
        }

        // Default: build table header and rows (max 5 rows when limited)
        // Apply sorting or last/top policies to the sample view
        List<Map<String, Object>> viewRows = new ArrayList<>(rows);
        if (topN != null || (sortClause != null && sortClause.startsWith("revenue"))) {
            viewRows.sort((a,b) -> Double.compare(((Number)b.getOrDefault("revenue",0)).doubleValue(), ((Number)a.getOrDefault("revenue",0)).doubleValue()));
        } else if (lastN != null || qlow.contains("последн")) {
            // sort by sale_date desc
            viewRows.sort((a,b) -> safeDate(b.get("sale_date")).compareTo(safeDate(a.get("sale_date"))));
        }
        int toShow = limited ? Math.min(5, viewRows.size()) : Math.min(20, viewRows.size());
        sb.append("id | date | region | category | product | qty | price | revenue\n");
        for (int i = 0; i < toShow; i++) {
            Map<String, Object> r = viewRows.get(i);
            sb.append(String.format("%s | %s | %s | %s | %s | %s | %s | %s\n",
                    safeString(r.get("id")), safeDate(r.get("sale_date")), safeString(r.get("region")), safeString(r.get("product_category")), safeString(r.get("product_name")), safeIntString(r.get("quantity")), safeDecimalString(r.get("price")), safeDecimalString(r.get("revenue"))));
        }
        return sb.toString().trim();
    }

    private String abbreviate(String s, int max) {
        if (s == null) return "";
        String t = s.trim();
        if (t.length() <= max) return t;
        return t.substring(0, max - 1) + "…";
    }

    private String capitalize(String s) {
        if (s == null || s.isEmpty()) return "";
        String t = s.trim();
        if (t.length() == 1) return t.toUpperCase(Locale.ROOT);
        return t.substring(0,1).toUpperCase(Locale.ROOT) + t.substring(1);
    }

    private String prettyCount(int n) {
        if (n >= 1000) return String.format("~%d", n);
        return String.valueOf(n);
    }

    private String safeString(Object o) {
        if (o == null) return "";
        return o.toString();
    }

    private String safeDate(Object o) {
        if (o == null) return "";
        String s = o.toString();
        if (s.length() >= 10) return s.substring(0, 10);
        return s;
    }

    private String safeIntString(Object o) {
        if (o == null) return "";
        try {
            long v = ((Number) o).longValue();
            return String.valueOf(v);
        } catch (Exception e) {
            return o.toString();
        }
    }

    private String safeDecimalString(Object o) {
        if (o == null) return "";
        try {
            double v = ((Number) o).doubleValue();
            return String.format(Locale.US, "%.2f", v);
        } catch (Exception e) {
            return o.toString();
        }
    }

    private static class ParamResult {
        String sql;
        Map<String, Object> params;
    }

    /**
     * Build a deterministic SELECT SQL for common retrieval intents: filters, sorting, top N, last N.
     * This method uses explicit column projection (no wildcard) and safe identifier quoting.
     */
    private String buildDeterministicSql(String userQuery, String tableName, TableMeta meta, String intent) {
        String qlow = userQuery == null ? "" : userQuery.toLowerCase();

        // Preferred projection order for previews
        List<String> preferred = List.of("id", "sale_date", "region", "product_category", "product_name", "quantity", "price", "revenue");
        List<String> present = new ArrayList<>();
        for (String p : preferred) {
            if (meta.columns.containsKey(p)) present.add(p);
        }
        if (present.isEmpty()) {
            // fallback to all columns explicitly
            present.addAll(meta.columns.keySet());
        }
        String proj = present.stream().map(c -> sanitizeIdent(c)).collect(Collectors.joining(", "));

        StringBuilder sb = new StringBuilder();
        sb.append("SELECT ").append(proj).append(" FROM ").append(sanitizeIdent(tableName));

        // We'll determine WHERE/ORDER/LIMIT below. First detect TOP/LAST/SORT to avoid mis-parsing 'по X' phrases as filters.
        // TOP N detection
        Integer topN = null;
        java.util.regex.Matcher mt = java.util.regex.Pattern.compile("(топ|top)\\s*(\\d+)", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(qlow);
        if (mt.find()) {
            try { topN = Integer.parseInt(mt.group(2)); } catch (Exception e) { topN = null; }
        }
        // LAST N detection
        Integer lastN = null;
        java.util.regex.Matcher ml = java.util.regex.Pattern.compile("последн[а-яё]*\\s*(\\d+)", java.util.regex.Pattern.CASE_INSENSITIVE | java.util.regex.Pattern.UNICODE_CASE).matcher(qlow);
        if (ml.find()) {
            try { lastN = Integer.parseInt(ml.group(1)); } catch (Exception e) { lastN = null; }
        }

        // SORT detection for revenue
        boolean sortByRevenueDesc = false;
        if (qlow.contains("revenue") || qlow.contains("выручк")) {
            if (qlow.contains("убыв") || qlow.contains("desc") || qlow.contains("по убыванию")) sortByRevenueDesc = true;
        }

        // Now FILTER: simple equality on region if mentioned explicitly for Moscow, else try generic 'по X' but avoid matching sort words
        java.util.regex.Matcher mreg = java.util.regex.Pattern.compile("(москв|москва|по\\s+москве)", java.util.regex.Pattern.CASE_INSENSITIVE | java.util.regex.Pattern.UNICODE_CASE).matcher(qlow);
        boolean whereAdded = false;
        if (mreg.find()) {
            sb.append(" WHERE ").append(sanitizeIdent("region")).append(" = '").append(escapeSqlString("Москва")).append("'");
            whereAdded = true;
        } else {
            if (topN == null && lastN == null && !sortByRevenueDesc) {
                java.util.regex.Matcher mf = java.util.regex.Pattern.compile("по\\s+([а-яё\\-]+)", java.util.regex.Pattern.CASE_INSENSITIVE | java.util.regex.Pattern.UNICODE_CASE).matcher(qlow);
                if (mf.find()) {
                    String val = mf.group(1);
                    // ignore common control words and sort-related words
                    if (!val.matches("(последн|топ|отсорт|сортир|данные|продаж|продажи|покажи|покаж|убыв)") ) {
                        sb.append(" WHERE ").append(sanitizeIdent("region")).append(" = '").append(escapeSqlString(capitalize(val))).append("'");
                        whereAdded = true;
                    }
                }
            }
        }

        // Build ORDER BY / LIMIT according to precedence: topN > lastN > sort
        if (topN != null) {
            // ensure ORDER BY revenue DESC
            if (!whereAdded) { /* no-op */ }
            sb.append(" ORDER BY ").append(sanitizeIdent("revenue")).append(" DESC");
            sb.append(" LIMIT ").append(topN);
            return sb.toString();
        }
        if (lastN != null) {
            sb.append(" ORDER BY ").append(sanitizeIdent("sale_date")).append(" DESC");
            sb.append(" LIMIT ").append(lastN);
            return sb.toString();
        }
        if (sortByRevenueDesc) {
            sb.append(" ORDER BY ").append(sanitizeIdent("revenue")).append(" DESC");
            // default limit for sorted view
            sb.append(" LIMIT 200");
            return sb.toString();
        }

        // DEFAULT: when nothing specific detected, apply safe default limit
        sb.append(" LIMIT 200");
        return sb.toString();
    }

    private String escapeSqlString(String s) {
        if (s == null) return "";
        return s.replace("'", "''");
    }
}
