import React, { useState } from 'react';

interface Column {
  key: string;
  label: string;
  type: string;
}

interface ColumnSelectorProps {
  columns: Column[];
  visibleColumns: string[];
  onToggleColumn: (columnKey: string) => void;
}

const ColumnSelector: React.FC<ColumnSelectorProps> = ({ columns, visibleColumns, onToggleColumn }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="column-selector">
      <button onClick={() => setIsOpen(!isOpen)}>Выбрать столбцы</button>
      {isOpen && (
        <div className="column-selector-dropdown">
          {columns.map(col => (
            <label key={col.key}>
              <input
                type="checkbox"
                checked={visibleColumns.includes(col.key)}
                onChange={() => onToggleColumn(col.key)}
              />
              {col.label || col.key}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default ColumnSelector;