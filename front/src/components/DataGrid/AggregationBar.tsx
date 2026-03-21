import React, { useState } from 'react';
import { useDataQuery } from '@hooks';

interface Column {
  key: string;
  label: string;
  type: string;
}

interface AggregationBarProps {
  columns: Column[];
}

const AGGREGATION_TYPES = [
  { value: 'sum', label: 'Сумма' },
  { value: 'avg', label: 'Среднее' },
  { value: 'count', label: 'Количество' },
  { value: 'min', label: 'Минимум' },
  { value: 'max', label: 'Максимум' },
  { value: 'count_distinct', label: 'Уникальных' }
];

const AggregationBar: React.FC<AggregationBarProps> = ({ columns }) => {
  if (!columns || !Array.isArray(columns)) return null;

  const { groupBy, aggregations, applyGroupBy, applyAggregations } = useDataQuery();
  const [selectedGroupBy, setSelectedGroupBy] = useState<string[]>(groupBy || []);
  const [selectedAggs, setSelectedAggs] = useState<any[]>(aggregations || []);
  const [showPanel, setShowPanel] = useState(false);

  const addAggregation = (column: string, type: string) => {
    setSelectedAggs([...selectedAggs, { column, type, alias: `${type}_${column}` }]);
  };

  const removeAggregation = (index: number) => {
    setSelectedAggs(selectedAggs.filter((_, i) => i !== index));
  };

  const addGroupBy = (column: string) => {
    if (!selectedGroupBy.includes(column)) {
      setSelectedGroupBy([...selectedGroupBy, column]);
    }
  };

  const removeGroupBy = (column: string) => {
    setSelectedGroupBy(selectedGroupBy.filter(c => c !== column));
  };

  const applyChanges = () => {
    applyGroupBy(selectedGroupBy);
    applyAggregations(selectedAggs);
    setShowPanel(false);
  };

  return (
    <div className="aggregation-bar">
      <div className="aggregation-controls">
        <button className="agg-button" onClick={() => setShowPanel(!showPanel)}>
          
        </button>
        {selectedGroupBy.length > 0 && (
          <div className="active-groupby">
            <span>Группировка: </span>
            {selectedGroupBy.map(col => (
              <span key={col} className="groupby-tag">
                {col}
                <button onClick={() => removeGroupBy(col)}>×</button>
              </span>
            ))}
          </div>
        )}
        {selectedAggs.length > 0 && (
          <div className="active-aggs">
            <span>Агрегаты: </span>
            {selectedAggs.map((agg, idx) => (
              <span key={idx} className="agg-tag">
                {agg.type}({agg.column})
                <button onClick={() => removeAggregation(idx)}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {showPanel && (
        <div className="agg-panel">
          <div className="agg-panel-section">
            <h4>Группировка по полям</h4>
            <div className="field-list">
              {columns.map(col => (
                <div key={col.key} className="field-item">
                  <span>{col.label || col.key}</span>
                  <button 
                    onClick={() => addGroupBy(col.key)}
                    disabled={selectedGroupBy.includes(col.key)}
                  >
                    Добавить
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="agg-panel-section">
            <h4>Агрегация</h4>
            <div className="field-list">
              {columns.filter(col => col.type === 'numeric').map(col => (
                <div key={col.key} className="field-item">
                  <span>{col.label || col.key}</span>
                  <select 
                    onChange={(e) => addAggregation(col.key, e.target.value)}
                    value=""
                  >
                    <option value="">Выбрать агрегацию</option>
                    {AGGREGATION_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div className="agg-panel-actions">
            <button onClick={applyChanges}>Применить</button>
            <button onClick={() => setShowPanel(false)}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AggregationBar;