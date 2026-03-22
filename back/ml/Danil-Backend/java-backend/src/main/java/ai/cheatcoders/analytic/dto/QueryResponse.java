package ai.cheatcoders.analytic.dto;

import java.util.List;
import java.util.Map;

public class QueryResponse {
    public List<Map<String, Object>> rows;
    public String nextCursor;
}
