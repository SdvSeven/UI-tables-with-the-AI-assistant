package com.example.pivotdemo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface SalesRepository extends JpaRepository<Sales, Long> {
    @Query(value = "SELECT region, SUM(revenue) as total_revenue FROM sales GROUP BY region ORDER BY total_revenue DESC", nativeQuery = true)
    List<Object[]> getRevenueByRegion();
}