package ai.cheatcoders.analytic.service;

import ai.cheatcoders.analytic.config.AppConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;


@Service
public class MistralService {

    private final WebClient client;
    private final AppConfig cfg;
    private final ObjectMapper mapper = new ObjectMapper();
    private final Logger log = LoggerFactory.getLogger(MistralService.class);

    public MistralService(AppConfig cfg) {
        this.cfg = cfg;
        this.client = WebClient.builder()
                .baseUrl("https://api.mistral.ai")
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + cfg.getMistralApiKey())
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    public String ask(String prompt) {
    String model = cfg.getMistralModel();
    // build proper JSON: { "model": "...", "messages": [ {"role":"user","content":"..."} ] }
    ObjectNode payloadRoot = mapper.createObjectNode();
    payloadRoot.put("model", model);
    ArrayNode payloadMessages = payloadRoot.putArray("messages");
    ObjectNode payloadMsg = mapper.createObjectNode();
    payloadMsg.put("role", "user");
    payloadMsg.put("content", prompt);
    payloadMessages.add(payloadMsg);

    String body = payloadRoot.toString();

        // Build a simple headers map for logging (mask API key)
        Map<String, String> loggedHeaders = new HashMap<>();
        loggedHeaders.put(HttpHeaders.AUTHORIZATION, "Bearer ***masked***");
        loggedHeaders.put(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);

        // Retry loop: 3 attempts with small backoff
        int maxAttempts = 3;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                log.info("Mistral request attempt {}:\nHeaders: {}\nBody: {}", attempt, loggedHeaders, body);

                try {
                    String res = client.post()
                            .uri("/v1/chat/completions")
                            .bodyValue(body)
                            .retrieve()
                            .bodyToMono(String.class)
                            .timeout(Duration.ofSeconds(30))
                            .block();

                    log.info("Mistral successful attempt {}: body={}", attempt, res);
                    JsonNode rootResp = mapper.readTree(res == null ? "" : res);
                    JsonNode choices = rootResp.path("choices");
                    if (choices.isArray() && choices.size() > 0) {
                        JsonNode msgContent = choices.get(0).path("message").path("content");
                        return msgContent.asText("");
                    }
                    return "";
                } catch (WebClientResponseException wce) {
                    int status = wce.getStatusCode().value();
                    String respBody = wce.getResponseBodyAsString();

                    log.error("Mistral error: status={}, body={}", status, respBody);

                    return "Mistral error: HTTP " + status + " " + (respBody == null ? "" : respBody);
                }
            } catch (Exception e) {
                log.error("Mistral request attempt {} failed: {}", attempt, e.toString());
                if (attempt < maxAttempts) {
                    try { Thread.sleep(500L * attempt); } catch (InterruptedException ignored) {}
                    continue;
                }
                return "Mistral error: " + e.getMessage();
            }
        }

        return "Mistral error: unknown";
    }
}
