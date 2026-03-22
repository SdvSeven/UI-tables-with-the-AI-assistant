import React, { useState, useEffect, useCallback } from 'react';
import { debounce } from '@utils';

interface Column {
  key: string;
  label: string;
  type: string;
}

interface FilterPanelProps {
  columns: Column[];
  filters: Record<string, any>;
  applyFilters: (newFilters: Record<string, any>) => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ columns, filters, applyFilters }) => {
  if (!columns || !Array.isArray(columns)) return null;

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

  const getInputType = (type: string): string => {
    if (type === 'date') return 'date';
    if (type === 'numeric' || type === 'integer') return 'number';
    return 'text';
  };

  return (
    <div className="filter-panel">
      <div className="filter-row">
        {columns.map(col => {
          const inputType = getInputType(col.type);
          return (
            <div key={col.key} className="filter-field">
              <label>{col.label || col.key}</label>
              <input
                type={inputType}
                value={localFilters[col.key] || ''}
                onChange={(e) => handleChange(col.key, e.target.value)}
                placeholder={`Filter by ${col.label}`}
              />
            </div>
          );
        })}
      </div>
      <div className="filter-actions">
        <button onClick={handleApplyNow}>Apply now</button>
        <button onClick={handleReset}>Reset</button>
      </div>
    </div>
  );
};

export default FilterPanel;