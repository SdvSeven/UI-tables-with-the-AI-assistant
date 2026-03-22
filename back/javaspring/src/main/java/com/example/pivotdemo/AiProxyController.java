package com.example.pivotdemo;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = "*")
public class AiProxyController {

    @Value("${ai.service.url:http://localhost:8082}")
    private String aiServiceUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    @PostMapping("/suggest")
    public ResponseEntity<?> suggest(@RequestBody Map<String, Object> request) {
        try {
            String url = aiServiceUrl + "/api/v1/insights/text";
            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("insight", "AI временно недоступен. Попробуйте позже."));
        }
    }

    // Опционально: поддержка natural language query
    @PostMapping("/nl-query")
    public ResponseEntity<?> nlQuery(@RequestBody Map<String, Object> request) {
        try {
            String url = aiServiceUrl + "/api/v1/orchestrator/nl-query";
            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}