package com.example.pivotdemo;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class PivotController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @GetMapping("/fields")
    public List<Map<String, String>> getFields() {
        return List.of(
            Map.of("name", "region", "type", "varchar"),
            Map.of("name", "product_category", "type", "varchar"),
            Map.of("name", "revenue", "type", "numeric"),
            Map.of("name", "sale_date", "type", "date")
        );
    }

    @GetMapping("/pivot")
    public List<Map<String, Object>> getPivot() {
        return jdbcTemplate.query(
            "SELECT region, SUM(revenue) as total_revenue FROM sales GROUP BY region ORDER BY total_revenue DESC",
            (rs, rowNum) -> {
                Map<String, Object> map = new HashMap<>();
                map.put("region", rs.getString("region"));
                map.put("total_revenue", rs.getBigDecimal("total_revenue"));
                return map;
            }
        );
    }

    @GetMapping("/sales")
    public List<Map<String, Object>> getSales() {
        return jdbcTemplate.query("SELECT * FROM sales LIMIT 100", (rs, rowNum) -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", rs.getLong("id"));
            map.put("region", rs.getString("region"));
            map.put("product_category", rs.getString("product_category"));
            map.put("revenue", rs.getBigDecimal("revenue"));
            map.put("sale_date", rs.getDate("sale_date"));
            return map;
        });
    }
}