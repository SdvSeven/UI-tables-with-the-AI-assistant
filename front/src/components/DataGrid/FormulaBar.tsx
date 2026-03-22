import React, { useState, useEffect, useRef } from 'react';

interface FormulaBarProps {
  rowId: number | null;
  column: string | null;
  initialValue: string;
  onSave: (rowId: number, column: string, newValue: string) => void;
  onCancel: () => void;
}

const FormulaBar: React.FC<FormulaBarProps> = ({
  rowId,
  column,
  initialValue,
  onSave,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialValue);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [initialValue]);

  const handleSave = () => {
    if (rowId !== null && column !== null) {
      onSave(rowId, column, value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (rowId === null || column === null) return null;

  return (
    <div className="formula-bar">
      <div className="formula-bar-cell">
        <span className="formula-bar-label">{column}:</span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Введите значение или формулу (начинайте с '=')"
        />
      </div>
      <div className="formula-bar-actions">
        <button className="formula-bar-save" onClick={handleSave} title="Сохранить (Enter)">
          ✓
        </button>
        <button className="formula-bar-cancel" onClick={onCancel} title="Отмена (Esc)">
          ✗
        </button>
      </div>
    </div>
  );
};

export default FormulaBar;