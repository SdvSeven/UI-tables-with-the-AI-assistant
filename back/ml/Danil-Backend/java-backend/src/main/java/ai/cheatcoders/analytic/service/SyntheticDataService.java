package ai.cheatcoders.analytic.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class SyntheticDataService {

    private final JdbcTemplate jdbc;

    public SyntheticDataService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void createTableIfNotExists(String tableName) {
        String sql = String.format("CREATE TABLE IF NOT EXISTS %s (id BIGSERIAL PRIMARY KEY, category TEXT, value DOUBLE PRECISION, ts TIMESTAMP)",
                sanitize(tableName));
        jdbc.execute(sql);
    }

    public void generateAndInsert(String tableName, int rows, int batchSize) {
        createTableIfNotExists(tableName);
        String insert = String.format("INSERT INTO %s (category, value, ts) VALUES (?, ?, now())", sanitize(tableName));
        List<Object[]> batch = new ArrayList<>();
        for (int i = 0; i < rows; i++) {
            String cat = "cat_" + (i % 10);
            double v = Math.random() * 1000;
            batch.add(new Object[]{cat, v});
            if (batch.size() >= batchSize) {
                jdbc.batchUpdate(insert, batch);
                batch.clear();
            }
        }
        if (!batch.isEmpty()) jdbc.batchUpdate(insert, batch);
    }

    private String sanitize(String s) {
        return '"' + s.replaceAll("[\"\\]", "") + '"';
    }
}
