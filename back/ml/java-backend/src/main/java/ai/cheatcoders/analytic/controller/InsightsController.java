package ai.cheatcoders.analytic.controller;

import ai.cheatcoders.analytic.service.MistralService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/insights")
public class InsightsController {

    private final MistralService mistral;

    public InsightsController(MistralService mistral) {
        this.mistral = mistral;
    }

    @PostMapping("/text")
    public ResponseEntity<Map<String, String>> getInsights(@RequestBody Map<String, Object> body) {
        String prompt = (String) body.getOrDefault("prompt", "Дай аналитический вывод по данным.");
        String res = mistral.ask(prompt);
        return ResponseEntity.ok(Map.of("insight", res));
    }
}
