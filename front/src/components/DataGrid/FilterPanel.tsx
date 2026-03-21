import React, { useState } from 'react';
import { useDataQuery } from '@hooks';

interface Column {
  key: string;
  label: string;
  type: string;
}

interface FilterPanelProps {
  columns: Column[];
}

const FilterPanel: React.FC<FilterPanelProps> = ({ columns }) => {
  if (!columns || !Array.isArray(columns)) return null;

  const { filters, applyFilters } = useDataQuery();
  const [localFilters, setLocalFilters] = useState<Record<string, any>>(filters);

  const handleChange = (field: string, value: any) => {
    setLocalFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleApply = () => {
    applyFilters(localFilters);
  };

  const handleReset = () => {
    setLocalFilters({});
    applyFilters({});
  };

  return (
    <div className="filter-panel">
      <div className="filter-row">
        {columns.filter(c => c.type === 'string' || c.type === 'date' || c.type === 'numeric').map(col => (
          <div key={col.key} className="filter-field">
            <label>{col.label || col.key}</label>
            <input
              type={col.type === 'date' ? 'date' : 'text'}
              value={localFilters[col.key] || ''}
              onChange={(e) => handleChange(col.key, e.target.value)}
              placeholder={`Фильтр по ${col.label}`}
            />
          </div>
        ))}
      </div>
      <div className="filter-actions">
        <button onClick={handleApply}>Применить</button>
        <button onClick={handleReset}>Сбросить</button>
      </div>
    </div>
  );
};

export default FilterPanel;