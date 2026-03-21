package ai.cheatcoders.analytic.dto;

public class FilterSpec {
    public String column;
    public String op; // =, !=, >, <, >=, <=, like, in
    public Object value;
}
