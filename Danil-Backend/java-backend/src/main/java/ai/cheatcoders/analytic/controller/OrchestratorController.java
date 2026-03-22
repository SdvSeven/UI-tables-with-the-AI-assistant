package ai.cheatcoders.analytic.controller;

import ai.cheatcoders.analytic.service.OrchestratorService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/v1/orchestrator")
public class OrchestratorController {

    private final OrchestratorService orchestrator;

    public OrchestratorController(OrchestratorService orchestrator) {
        this.orchestrator = orchestrator;
    }

    @PostMapping("/nl-query")
    public ResponseEntity<?> nlQuery(@RequestBody Map<String, Object> body) {
        String table = (String) body.get("table");
        String question = (String) body.get("question");
        boolean explain = Boolean.parseBoolean(String.valueOf(body.getOrDefault("explain", "false")));
        if (table == null || question == null) return ResponseEntity.badRequest().body(Map.of("error", "table and question required"));

        try {
            OrchestratorService.NLResult res = orchestrator.handleNaturalLanguageQuery(table, question, explain);
            java.util.Map<String, Object> resp = new java.util.HashMap<>();
            resp.put("intent", res.intent == null ? "data_retrieval" : res.intent);
            resp.put("source", res.source == null ? table : res.source);
            resp.put("status", "success");
            resp.put("sql", res.sql == null ? "" : res.sql);
            int rowCount = res.rows == null ? 0 : res.rows.size();
            resp.put("row_count", rowCount);
            resp.put("data", res.rows == null ? List.of() : res.rows);
            resp.put("insight", res.explanation == null ? null : res.explanation);
            // build user-friendly display string (server-side)
            try {
                String display = orchestrator.buildDisplayResponse(res, table, question);
                resp.put("display", display);
            } catch (Exception e) {
                // best-effort: if display building fails, do not block the API
                resp.put("display", "");
            }
            // if sampling applied, surface pagination metadata
            if (res.totalCount != null && res.totalCount > rowCount) {
                java.util.Map<String, Object> meta = new java.util.HashMap<>();
                meta.put("total_count", res.totalCount);
                meta.put("mode", "sampled");
                resp.put("metadata", meta);
            }
            return ResponseEntity.ok(resp);
        } catch (IllegalArgumentException iae) {
            java.util.Map<String, Object> err = new java.util.HashMap<>();
            String msg = iae.getMessage() == null ? "" : iae.getMessage();
            if (msg.startsWith("Unsafe:")) {
                err.put("status", "unsafe_query");
                err.put("error", msg);
            } else {
                err.put("status", "error");
                err.put("error", msg);
            }
            return ResponseEntity.badRequest().body(err);
        }
    }
}
