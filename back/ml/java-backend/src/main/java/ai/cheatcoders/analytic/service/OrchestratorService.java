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
    private static final Set<String> ALLOWED_TABLES = Set.of("sales");

    public OrchestratorService(MistralService mistral, QueryService queryService, JdbcTemplate jdbc) {
        this.mistral = mistral;
        this.queryService = queryService;
        this.jdbc = jdbc;
    }

    public TableMeta getTableMeta(String tableName) {
        String sql = "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = :tbl";
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
            TableMeta meta = getTableMeta(tableName);
            List<Map<String, Object>> sample = sampleRows(tableName, 5);

            String prompt = buildSqlPrompt(tableName, meta, sample, userQuery);
            log.debug("LLM prompt: {}", prompt);

            String llmResponse = mistral.ask(prompt);
            log.debug("LLM raw response: {}", llmResponse);

            // Strict contract: LLM must return JSON: { "sql": "<SELECT ...>" }
            String sql;
            try {
                // parse raw response as JSON strictly; do not accept non-JSON or try to fix it
                Map<String, Object> map = JSON.readValue(llmResponse, new TypeReference<Map<String, Object>>() {});
                Object s = map.get("sql");
                if (s == null || !(s instanceof String)) {
                    log.warn("LLM response JSON missing 'sql' field or it is not a string: {}", llmResponse);
                    throw new IllegalArgumentException("Invalid LLM response format");
                }
                sql = ((String) s).trim();
            } catch (Exception e) {
                log.warn("Invalid LLM response format: {}", e.getMessage());
                throw new IllegalArgumentException("Invalid LLM response format");
            }

            sql = sql.trim();
            if (sql.endsWith(";")) sql = sql.substring(0, sql.length() - 1);

            validateSelect(sql);
            // additional safety checks against allow-list and column restrictions
            validateSqlSafety(sql, meta);

            ParamResult pr = parameterizeLiterals(sql);
            log.debug("Executing SQL (parameterized): {} with params {}", pr.sql, pr.params);

            List<Map<String, Object>> rows = queryService.executeSelect(pr.sql, pr.params);

            NLResult res = new NLResult();
            res.sql = pr.sql;
            res.rows = rows;

            if (explainWithLLM) {
                String resultSnippet = rows.stream().limit(10).map(Object::toString).collect(Collectors.joining("\n"));
                StringBuilder ep = new StringBuilder();
                ep.append("Интерпретируй результаты запроса и укажи ключевые наблюдения. SQL: ");
                ep.append(pr.sql).append("\n");
                ep.append("Результат (первые строки):\n");
                ep.append(resultSnippet);
                String explanation = mistral.ask(ep.toString());
                res.explanation = explanation;
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
    private void validateSqlSafety(String sql, TableMeta meta) {
        String s = sql.trim();
        // basic checks
        if (!SELECT_START.matcher(s).find()) throw new IllegalArgumentException("Unsafe: must start with SELECT");
        if (s.contains(";")) throw new IllegalArgumentException("Unsafe: semicolons are not allowed");
        if (s.contains("--")) throw new IllegalArgumentException("Unsafe: SQL comments not allowed");
        if (s.contains("/*") || s.contains("*/")) throw new IllegalArgumentException("Unsafe: block comments not allowed");

        // forbidden keywords
        Matcher forb = FORBIDDEN.matcher(s);
        if (forb.find()) throw new IllegalArgumentException("Unsafe: forbidden keyword " + forb.group(1));

        // disallow JOINs and UNIONs
        if (Pattern.compile("(?i)\\bjoin\\b").matcher(s).find()) throw new IllegalArgumentException("Unsafe: JOINs are not allowed");
        if (Pattern.compile("(?i)\\bunion\\b").matcher(s).find()) throw new IllegalArgumentException("Unsafe: UNION is not allowed");

        // disallow subqueries
        if (Pattern.compile("(?i)\\(\\s*select\\b").matcher(s).find()) throw new IllegalArgumentException("Unsafe: subqueries are not allowed");

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
                if (!ALLOWED_TABLES.contains(token.toLowerCase())) {
                    throw new IllegalArgumentException("Unsafe: usage of disallowed table: " + token);
                }
            }
        } else {
            throw new IllegalArgumentException("Unsafe: cannot find FROM clause");
        }

        // restrict columns: parse projection and ensure every column referenced is in meta.columns
        Pattern selPat = Pattern.compile("(?i)\\bselect\\b\\s+([\\s\\S]+?)\\bfrom\\b", Pattern.DOTALL);
        Matcher ms = selPat.matcher(s);
        if (ms.find()) {
            String proj = ms.group(1);
            if (proj.contains("*")) throw new IllegalArgumentException("Unsafe: wildcard * not allowed");
            // split by commas and inspect identifiers
            String[] items = proj.split(",");
            Set<String> allowedCols = meta.columns.keySet();
            // allow common agg function names
            Set<String> funcs = Set.of("avg","sum","min","max","count");
            for (String item : items) {
                // remove function calls and parentheses
                String cleaned = item.replaceAll("\\b(AVG|SUM|MIN|MAX|COUNT)\\s*\\(", "").replaceAll("\\)", " ");
                // remove aliases (as ...)
                cleaned = cleaned.replaceAll("(?i)\\s+as\\s+\\w+", "");
                // find identifiers
                Matcher idm = Pattern.compile("\\b([A-Za-z_][A-Za-z0-9_]*)\\b").matcher(cleaned);
                while (idm.find()) {
                    String ident = idm.group(1);
                    String lower = ident.toLowerCase();
                    if (funcs.contains(lower)) continue;
                    // skip SQL keywords
                    if (lower.matches("select|from|where|group|by|order|having|distinct|on|and|or|not")) continue;
                    // if it's not an allowed column, reject
                    if (!allowedCols.contains(ident) && !allowedCols.contains(ident.toLowerCase()) && !allowedCols.contains(ident.toUpperCase())) {
                        throw new IllegalArgumentException("Unsafe: usage of disallowed column: " + ident);
                    }
                }
            }
        } else {
            throw new IllegalArgumentException("Unsafe: cannot parse projection");
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
    }

    private static class ParamResult {
        String sql;
        Map<String, Object> params;
    }
}
