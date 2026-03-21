export interface QueryParams {
  table: string;
  filters?: Record<string, any>;
  groupBy?: string[];
  aggregations?: Array<{ column: string; type: string; alias: string }>;
  limit?: number;
  offset?: number;
  sort?: { column: string; direction: 'asc' | 'desc' };
}

export class QueryBuilder {
  private query: QueryParams;

  constructor(tableName: string) {
    this.query = {
      table: tableName,
      filters: {},
      groupBy: [],
      aggregations: [],
      limit: 100,
      offset: 0,
      sort: { column: 'id', direction: 'asc' }
    };
  }

  withFilters(filters: Record<string, any>): this {
    this.query.filters = filters;
    return this;
  }

  withGroupBy(fields: string[]): this {
    this.query.groupBy = fields;
    return this;
  }

  withAggregations(aggs: Array<{ column: string; type: string; alias: string }>): this {
    this.query.aggregations = aggs;
    return this;
  }

  withLimit(limit: number): this {
    this.query.limit = limit;
    return this;
  }

  withOffset(offset: number): this {
    this.query.offset = offset;
    return this;
  }

  withSort(column: string, direction: 'asc' | 'desc'): this {
    this.query.sort = { column, direction };
    return this;
  }

  build(): QueryParams {
    return { ...this.query };
  }
}

export default QueryBuilder;