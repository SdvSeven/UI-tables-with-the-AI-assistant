package ai.cheatcoders.analytic.service;

import ai.cheatcoders.analytic.dto.AggregationSpec;
import ai.cheatcoders.analytic.dto.FilterSpec;
import ai.cheatcoders.analytic.dto.QueryRequest;
import ai.cheatcoders.analytic.dto.QueryResponse;
import ai.cheatcoders.analytic.repository.AnalyticsRepository;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class AnalyticsService {

    private final AnalyticsRepository repo;

    public AnalyticsService(AnalyticsRepository repo) {
        this.repo = repo;
    }

    // Простая и безопасная сборка SQL для MVP. В production нужно использовать белые списки столбцов/таблиц.
    public QueryResponse runQuery(String tableName, QueryRequest req) {
        String selectClause;
        if (req.select == null || req.select.isEmpty()) {
            selectClause = "*";
        } else {
            selectClause = req.select.stream().map(this::safeIdentifier).collect(Collectors.joining(", "));
        }

        // Aggregations
        if (req.aggregations != null && !req.aggregations.isEmpty()) {
            List<String> aggs = new ArrayList<>();
            for (AggregationSpec a : req.aggregations) {
                String col = safeIdentifier(a.column);
                String alias = a.alias != null ? a.alias : (a.type.toLowerCase() + "_" + a.column);
                aggs.add(String.format("%s(%s) as %s", a.type.toUpperCase(), col, safeIdentifier(alias)));
            }
            if (req.groupBy != null && !req.groupBy.isEmpty()) {
                String groups = req.groupBy.stream().map(this::safeIdentifier).collect(Collectors.joining(", "));
                selectClause = groups + ", " + String.join(", ", aggs);
            } else {
                selectClause = String.join(", ", aggs);
            }
        }

        StringBuilder sql = new StringBuilder();
        sql.append("SELECT ").append(selectClause).append(" FROM ").append(safeIdentifier(tableName));

        Map<String, Object> params = new HashMap<>();
        if (req.filters != null && !req.filters.isEmpty()) {
            String where = req.filters.stream().map(f -> {
                String placeholder = f.column.replaceAll("[^a-zA-Z0-9]", "_");
                switch (f.op) {
                    case "=":
                    case "!=":
                    case ">":
                    case "<":
                    case ">=":
                    case "<=":
                        params.put(placeholder, f.value);
                        return safeIdentifier(f.column) + " " + f.op + " :" + placeholder;
                    case "like":
                        params.put(placeholder, f.value);
                        return safeIdentifier(f.column) + " LIKE :" + placeholder;
                    case "in":
                        params.put(placeholder, f.value);
                        return safeIdentifier(f.column) + " IN (:" + placeholder + ")";
                    default:
                        throw new IllegalArgumentException("Unsupported op: " + f.op);
                }
            }).collect(Collectors.joining(" AND "));
            sql.append(" WHERE ").append(where);
        }

        if (req.groupBy != null && !req.groupBy.isEmpty()) {
            sql.append(" GROUP BY ").append(req.groupBy.stream().map(this::safeIdentifier).collect(Collectors.joining(", ")));
        }

        // limit
        int limit = req.limit != null ? req.limit : 100;
        sql.append(" LIMIT ").append(limit + 1); // +1 to detect nextCursor

        List<Map<String, Object>> rows = repo.query(sql.toString(), params);
        String nextCursor = null;
        if (rows.size() > limit) {
            Map<String, Object> last = rows.get(limit - 1);
            nextCursor = Base64.getEncoder().encodeToString(last.toString().getBytes());
            rows = rows.subList(0, limit);
        }

        QueryResponse resp = new QueryResponse();
        resp.rows = rows;
        resp.nextCursor = nextCursor;
        return resp;
    }

    private String safeIdentifier(String id) {
        // Простая санитизация для MVP
        return '"' + id.replaceAll("[\"\\]", "") + '"';
    }
}
