package ai.cheatcoders.analytic.service;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class QueryService {

    private final NamedParameterJdbcTemplate jdbc;

    public QueryService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> executeSelect(String sql, Map<String, Object> params) {
        MapSqlParameterSource src = new MapSqlParameterSource();
        if (params != null) params.forEach(src::addValue);
        return jdbc.queryForList(sql, src);
    }

}
