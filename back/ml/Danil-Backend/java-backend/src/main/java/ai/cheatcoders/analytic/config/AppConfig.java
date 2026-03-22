package ai.cheatcoders.analytic.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AppConfig {

    @Value("${MISTRAL_API_KEY:}")
    private String mistralApiKey;

    @Value("${MISTRAL_MODEL:mistral-tiny}")
    private String mistralModel;

    public String getMistralApiKey() {
        return mistralApiKey;
    }

    public String getMistralModel() {
        return mistralModel;
    }
}
