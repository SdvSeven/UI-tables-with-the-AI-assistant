package ai.cheatcoders.analytic.startup;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class DatabaseHealthCheck {

    private final Logger log = LoggerFactory.getLogger(DatabaseHealthCheck.class);
    private final JdbcTemplate jdbc;

    public DatabaseHealthCheck(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        try {
            Integer one = jdbc.queryForObject("SELECT 1", Integer.class);
            log.info("Database connectivity check passed, SELECT 1 = {}", one);
        } catch (Exception e) {
            log.error("Database connectivity check failed", e);
            // fail fast
            throw new IllegalStateException("Cannot connect to database: " + e.getMessage(), e);
        }
    }
}
