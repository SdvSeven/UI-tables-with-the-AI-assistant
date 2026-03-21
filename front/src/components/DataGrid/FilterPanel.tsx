import React, { useState, useEffect, useCallback } from 'react';
import { useDataQuery } from '@hooks';
import { debounce } from '@utils';

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

  const debouncedApply = useCallback(
    debounce((newFilters: Record<string, any>) => {
      applyFilters(newFilters);
    }, 500),
    [applyFilters]
  );

  useEffect(() => {
    debouncedApply(localFilters);
  }, [localFilters, debouncedApply]);

  const handleChange = (field: string, value: any) => {
    setLocalFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleReset = () => {
    setLocalFilters({});
    applyFilters({});
  };

  const handleApplyNow = () => {
    applyFilters(localFilters);
  };

  return (
    <div className="filter-panel">
      <div className="filter-row">
        {columns.map(col => (
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
        <button onClick={handleApplyNow}>Применить сейчас</button>
        <button onClick={handleReset}>Сбросить</button>
      </div>
    </div>
  );
};

export default FilterPanel;