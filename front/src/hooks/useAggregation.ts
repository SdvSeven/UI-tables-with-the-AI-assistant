import { useMemo } from 'react';

export const useAggregation = (data: any[], aggregations: any[], groupBy: string[]) => {
  const aggregated = useMemo(() => {
    if (!groupBy.length || !aggregations.length) return [];

    const groups = new Map();
    data.forEach(row => {
      const key = groupBy.map(f => row[f]).join('|');
      if (!groups.has(key)) groups.set(key, { ...row });
      const group = groups.get(key);
      aggregations.forEach(agg => {
        const value = row[agg.column];
        if (agg.type === 'sum') {
          group[agg.alias] = (group[agg.alias] || 0) + value;
        } else if (agg.type === 'count') {
          group[agg.alias] = (group[agg.alias] || 0) + 1;
        } else if (agg.type === 'avg') {
          group[agg.alias] = (group[agg.alias] || 0) + value;
          group[`${agg.alias}_count`] = (group[`${agg.alias}_count`] || 0) + 1;
        }
      });
    });
    // Вычисление средних
    groups.forEach(group => {
      aggregations.forEach(agg => {
        if (agg.type === 'avg') {
          group[agg.alias] = group[agg.alias] / group[`${agg.alias}_count`];
          delete group[`${agg.alias}_count`];
        }
      });
    });
    return Array.from(groups.values());
  }, [data, aggregations, groupBy]);

  return aggregated;
};