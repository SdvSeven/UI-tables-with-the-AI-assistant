import React, { useMemo } from 'react';
import { useDataQuery } from '@hooks';

const PivotTable: React.FC = () => {
  const { data, groupBy, aggregations } = useDataQuery();

  const pivotData = useMemo(() => {
    if (!groupBy.length || !aggregations.length) return [];

    const groups = new Map<string, any>();
    data.forEach(row => {
      const key = groupBy.map(f => row[f]).join('|');
      if (!groups.has(key)) groups.set(key, { ...row });
      const group = groups.get(key)!;
      aggregations.forEach(agg => {
        const value = row[agg.column];
        if (agg.type === 'sum') {
          group[agg.alias] = (group[agg.alias] || 0) + value;
        } else if (agg.type === 'count') {
          group[agg.alias] = (group[agg.alias] || 0) + 1;
        }
      });
    });
    return Array.from(groups.values());
  }, [data, groupBy, aggregations]);

  if (!groupBy.length) return <div>Выберите поля для группировки</div>;

  return (
    <div className="pivot-table">
      <table>
        <thead>
          <tr>
            {groupBy.map(f => <th key={f}>{f}</th>)}
            {aggregations.map(agg => <th key={agg.alias}>{agg.type}({agg.column})</th>)}
          </tr>
        </thead>
        <tbody>
          {pivotData.map((row, idx) => (
            <tr key={idx}>
              {groupBy.map(f => <td key={f}>{row[f]}</td>)}
              {aggregations.map(agg => <td key={agg.alias}>{row[agg.alias]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PivotTable;