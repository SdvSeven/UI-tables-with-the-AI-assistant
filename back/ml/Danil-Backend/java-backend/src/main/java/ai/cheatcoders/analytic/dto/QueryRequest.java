package ai.cheatcoders.analytic.dto;

import java.util.List;
import java.util.Map;

public class QueryRequest {
    public List<String> select;
    public List<FilterSpec> filters;
    public List<String> groupBy;
    public List<AggregationSpec> aggregations;
    public Integer limit = 100;
    public String cursor;
    public PivotSpec pivot;

    public static class PivotSpec {
        public String pivotColumn;
        public List<String> valueColumns;
    }

}
