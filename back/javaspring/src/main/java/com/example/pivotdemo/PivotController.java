package com.example.pivotdemo;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class PivotController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    // ==================== GET /api/fields ====================
    @GetMapping("/fields")
    public List<Map<String, String>> getFields() {
        return List.of(
            Map.of("name", "id", "type", "integer"),
            Map.of("name", "sale_date", "type", "date"),
            Map.of("name", "region", "type", "varchar"),
            Map.of("name", "product_category", "type", "varchar"),
            Map.of("name", "product_name", "type", "varchar"),
            Map.of("name", "quantity", "type", "integer"),
            Map.of("name", "price", "type", "numeric"),
            Map.of("name", "revenue", "type", "numeric"),
            Map.of("name", "customer_id", "type", "integer"),
            Map.of("name", "payment_method", "type", "varchar"),
            Map.of("name", "discount", "type", "numeric"),
            Map.of("name", "extra_attributes", "type", "jsonb")
        );
    }

    // ==================== GET /api/sales ====================
    @GetMapping("/sales")
    public List<Map<String, Object>> getSales(
            @RequestParam(required = false) Long id,
            @RequestParam(required = false) String region,
            @RequestParam(required = false) String productCategory,
            @RequestParam(required = false) String productName,
            @RequestParam(required = false) String paymentMethod,
            @RequestParam(required = false) BigDecimal minRevenue,
            @RequestParam(required = false) BigDecimal maxRevenue,
            @RequestParam(required = false) LocalDate startDate,
            @RequestParam(required = false) LocalDate endDate,
            @RequestParam(required = false) Integer quantity,
            @RequestParam(required = false) BigDecimal price,
            @RequestParam(required = false) BigDecimal discount,
            @RequestParam(defaultValue = "id") String sort,
            @RequestParam(defaultValue = "asc") String order,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "100") int limit) {

        int maxLimit = 10000;
        if (limit > maxLimit) limit = maxLimit;

        List<String> conditions = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        if (id != null) {
            conditions.add("id = ?");
            params.add(id);
        }
        if (region != null && !region.isEmpty()) {
            conditions.add("region = ?");
            params.add(region);
        }
        if (productCategory != null && !productCategory.isEmpty()) {
            conditions.add("product_category = ?");
            params.add(productCategory);
        }
        if (productName != null && !productName.isEmpty()) {
            conditions.add("product_name = ?");
            params.add(productName);
        }
        if (paymentMethod != null && !paymentMethod.isEmpty()) {
            conditions.add("payment_method = ?");
            params.add(paymentMethod);
        }
        if (minRevenue != null) {
            conditions.add("revenue >= ?");
            params.add(minRevenue);
        }
        if (maxRevenue != null) {
            conditions.add("revenue <= ?");
            params.add(maxRevenue);
        }
        if (startDate != null) {
            conditions.add("sale_date >= ?");
            params.add(startDate);
        }
        if (endDate != null) {
            conditions.add("sale_date <= ?");
            params.add(endDate);
        }
        if (quantity != null) {
            conditions.add("quantity = ?");
            params.add(quantity);
        }
        if (price != null) {
            conditions.add("price = ?");
            params.add(price);
        }
        if (discount != null) {
            conditions.add("discount = ?");
            params.add(discount);
        }

        String where = conditions.isEmpty() ? "" : " WHERE " + String.join(" AND ", conditions);

        Set<String> allowedSortColumns = Set.of(
            "id", "sale_date", "region", "product_category", "product_name",
            "quantity", "price", "revenue", "customer_id", "payment_method", "discount"
        );
        if (!allowedSortColumns.contains(sort)) {
            sort = "id";
        }
        String sortOrder = order.equalsIgnoreCase("desc") ? "DESC" : "ASC";

        String sql = "SELECT id, sale_date, region, product_category, product_name, quantity, price, revenue, customer_id, payment_method, discount, extra_attributes " +
                     "FROM sales" + where +
                     " ORDER BY " + sort + " " + sortOrder +
                     " OFFSET ? LIMIT ?";
        params.add(offset);
        params.add(limit);

        return jdbcTemplate.query(sql, params.toArray(), (rs, rowNum) -> {
            Map<String, Object> row = new HashMap<>();
            row.put("id", rs.getLong("id"));
            row.put("sale_date", rs.getDate("sale_date"));
            row.put("region", rs.getString("region"));
            row.put("product_category", rs.getString("product_category"));
            row.put("product_name", rs.getString("product_name"));
            row.put("quantity", rs.getInt("quantity"));
            row.put("price", rs.getBigDecimal("price"));
            row.put("revenue", rs.getBigDecimal("revenue"));
            row.put("customer_id", rs.getInt("customer_id"));
            row.put("payment_method", rs.getString("payment_method"));
            row.put("discount", rs.getBigDecimal("discount"));
            row.put("extra_attributes", rs.getString("extra_attributes"));
            return row;
        });
    }

    // ==================== GET /api/sales/count ====================
    @GetMapping("/sales/count")
    public Map<String, Long> getSalesCount(
            @RequestParam(required = false) Long id,
            @RequestParam(required = false) String region,
            @RequestParam(required = false) String productCategory,
            @RequestParam(required = false) String productName,
            @RequestParam(required = false) String paymentMethod,
            @RequestParam(required = false) BigDecimal minRevenue,
            @RequestParam(required = false) BigDecimal maxRevenue,
            @RequestParam(required = false) LocalDate startDate,
            @RequestParam(required = false) LocalDate endDate,
            @RequestParam(required = false) Integer quantity,
            @RequestParam(required = false) BigDecimal price,
            @RequestParam(required = false) BigDecimal discount) {

        List<String> conditions = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        if (id != null) {
            conditions.add("id = ?");
            params.add(id);
        }
        if (region != null && !region.isEmpty()) {
            conditions.add("region = ?");
            params.add(region);
        }
        if (productCategory != null && !productCategory.isEmpty()) {
            conditions.add("product_category = ?");
            params.add(productCategory);
        }
        if (productName != null && !productName.isEmpty()) {
            conditions.add("product_name = ?");
            params.add(productName);
        }
        if (paymentMethod != null && !paymentMethod.isEmpty()) {
            conditions.add("payment_method = ?");
            params.add(paymentMethod);
        }
        if (minRevenue != null) {
            conditions.add("revenue >= ?");
            params.add(minRevenue);
        }
        if (maxRevenue != null) {
            conditions.add("revenue <= ?");
            params.add(maxRevenue);
        }
        if (startDate != null) {
            conditions.add("sale_date >= ?");
            params.add(startDate);
        }
        if (endDate != null) {
            conditions.add("sale_date <= ?");
            params.add(endDate);
        }
        if (quantity != null) {
            conditions.add("quantity = ?");
            params.add(quantity);
        }
        if (price != null) {
            conditions.add("price = ?");
            params.add(price);
        }
        if (discount != null) {
            conditions.add("discount = ?");
            params.add(discount);
        }

        String where = conditions.isEmpty() ? "" : " WHERE " + String.join(" AND ", conditions);
        String sql = "SELECT COUNT(*) FROM sales" + where;
        Long count = jdbcTemplate.queryForObject(sql, params.toArray(), Long.class);
        return Map.of("count", count);
    }

    // ==================== GET /api/sales/{id} ====================
    @GetMapping("/sales/{id}")
    public Map<String, Object> getSaleById(@PathVariable Long id) {
        return jdbcTemplate.queryForObject(
            "SELECT id, sale_date, region, product_category, product_name, quantity, price, revenue, customer_id, payment_method, discount, extra_attributes FROM sales WHERE id = ?",
            (rs, rowNum) -> {
                Map<String, Object> row = new HashMap<>();
                row.put("id", rs.getLong("id"));
                row.put("sale_date", rs.getDate("sale_date"));
                row.put("region", rs.getString("region"));
                row.put("product_category", rs.getString("product_category"));
                row.put("product_name", rs.getString("product_name"));
                row.put("quantity", rs.getInt("quantity"));
                row.put("price", rs.getBigDecimal("price"));
                row.put("revenue", rs.getBigDecimal("revenue"));
                row.put("customer_id", rs.getInt("customer_id"));
                row.put("payment_method", rs.getString("payment_method"));
                row.put("discount", rs.getBigDecimal("discount"));
                row.put("extra_attributes", rs.getString("extra_attributes"));
                return row;
            },
            id
        );
    }

    // ==================== POST /api/sales ====================
    @PostMapping("/sales")
    public Map<String, Long> createSale(@RequestBody Map<String, Object> saleData) {
        String sql = "INSERT INTO sales (sale_date, region, product_category, product_name, quantity, price, revenue, customer_id, payment_method, discount, extra_attributes) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb) RETURNING id";
        Long id = jdbcTemplate.queryForObject(sql, Long.class,
            saleData.get("sale_date"),
            saleData.get("region"),
            saleData.get("product_category"),
            saleData.get("product_name"),
            saleData.get("quantity"),
            saleData.get("price"),
            saleData.get("revenue"),
            saleData.get("customer_id"),
            saleData.get("payment_method"),
            saleData.get("discount"),
            saleData.get("extra_attributes") != null ? saleData.get("extra_attributes").toString() : null
        );
        return Map.of("id", id);
    }

    // ==================== PUT /api/sales/{id} ====================
    @PutMapping("/sales/{id}")
    public void updateSale(@PathVariable Long id, @RequestBody Map<String, Object> saleData) {
        String sql = "UPDATE sales SET sale_date = ?, region = ?, product_category = ?, product_name = ?, quantity = ?, price = ?, revenue = ?, customer_id = ?, payment_method = ?, discount = ?, extra_attributes = ?::jsonb WHERE id = ?";
        jdbcTemplate.update(sql,
            saleData.get("sale_date"),
            saleData.get("region"),
            saleData.get("product_category"),
            saleData.get("product_name"),
            saleData.get("quantity"),
            saleData.get("price"),
            saleData.get("revenue"),
            saleData.get("customer_id"),
            saleData.get("payment_method"),
            saleData.get("discount"),
            saleData.get("extra_attributes") != null ? saleData.get("extra_attributes").toString() : null,
            id
        );
    }

    // ==================== DELETE /api/sales/{id} ====================
    @DeleteMapping("/sales/{id}")
    public void deleteSale(@PathVariable Long id) {
        jdbcTemplate.update("DELETE FROM sales WHERE id = ?", id);
    }

    // ==================== GET /api/pivot ====================
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
}