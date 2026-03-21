package ai.cheatcoders.analytic.controller;

import ai.cheatcoders.analytic.dto.QueryRequest;
import ai.cheatcoders.analytic.dto.QueryResponse;
import ai.cheatcoders.analytic.service.AnalyticsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @PostMapping("/table/{tableName}/query")
    public ResponseEntity<QueryResponse> queryTable(@PathVariable String tableName, @RequestBody QueryRequest request) {
        QueryResponse resp = analyticsService.runQuery(tableName, request);
        return ResponseEntity.ok(resp);
    }
}
