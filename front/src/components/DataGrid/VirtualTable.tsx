import React, { useCallback, useState, useRef, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { InfiniteLoader } from 'react-window-infinite-loader';
import { useDataQuery } from '@hooks';
import { api } from '@services';

interface Column {
  key: string;
  label: string;
  type: string;
  width?: number;
}

interface VirtualTableProps {
  columns: Column[];
  height?: number;
  rowHeight?: number;
}

const VirtualTable: React.FC<VirtualTableProps> = ({ columns, height = 500, rowHeight = 32 }) => {
  if (!columns || !Array.isArray(columns)) return null;

  const { data, hasMore, loading, sort, applySort, updateRecord, loadMoreRows } = useDataQuery();

  const [editingCell, setEditingCell] = useState<{ rowId: number | null; column: string | null }>({ rowId: null, column: null });
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Сохраняем текущую редактируемую ячейку
  const saveCurrentEdit = useCallback(async () => {
    if (editingCell.rowId !== null && editingCell.column !== null) {
      await saveEdit(editingCell.rowId, editingCell.column);
    }
  }, [editingCell]);

  useEffect(() => {
    if (editingCell.rowId !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const formatCellValue = (value: any, type: string): string => {
    if (value === null || value === undefined) return '—';
    if (type === 'numeric') {
      if (typeof value === 'number') return value.toLocaleString('ru-RU');
      return value;
    }
    if (type === 'date') {
      return new Date(value).toLocaleDateString('ru-RU');
    }
    if (type === 'json') {
      return 'JSON';
    }
    return String(value);
  };

  const startEditing = async (rowId: number, column: string, currentValue: any) => {
    // Сохраняем предыдущую ячейку, если была активна
    if (editingCell.rowId !== null && editingCell.column !== null) {
      await saveCurrentEdit();
    }
    let formula: string | null = null;
    try {
      formula = await api.getCellFormula(rowId, column);
    } catch (err) {
      console.warn('Failed to fetch formula', err);
    }
    const displayValue = formula !== null ? formula : (currentValue !== undefined ? String(currentValue) : '');
    setEditingCell({ rowId, column });
    setEditValue(displayValue);
  };

  const saveEdit = async (rowId: number, column: string) => {
    const originalRow = data.find(row => row.id === rowId);
    if (!originalRow) return;

    let newValue: any = editValue;
    const colDef = columns.find(c => c.key === column);
    if (colDef && !editValue.startsWith('=')) {
      if (colDef.type === 'numeric') {
        newValue = parseFloat(editValue);
        if (isNaN(newValue)) newValue = 0;
      } else if (colDef.type === 'integer') {
        newValue = parseInt(editValue);
        if (isNaN(newValue)) newValue = 0;
      } else if (colDef.type === 'json') {
        try {
          newValue = JSON.parse(editValue);
        } catch (e) {
          alert('Неверный формат JSON');
          setEditingCell({ rowId: null, column: null });
          return;
        }
      }
    }

    try {
      await updateRecord(rowId, { [column]: newValue });
    } catch (err) {
      alert('Ошибка сохранения');
    } finally {
      setEditingCell({ rowId: null, column: null });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowId: number, column: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit(rowId, column);
    } else if (e.key === 'Escape') {
      setEditingCell({ rowId: null, column: null });
    }
  };

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const row = data[index];
    if (!row) return null;

    return (
      <div style={style} className="virtual-row">
        {columns.map(col => {
          const isEditing = editingCell.rowId === row.id && editingCell.column === col.key;
          const value = row[col.key];

          if (isEditing) {
            return (
              <div
                key={col.key}
                className="virtual-cell editing"
                style={{
                  width: col.width || 150,
                  textAlign: col.type === 'numeric' ? 'right' : 'left',
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, row.id, col.key)}
                  style={{
                    width: '100%',
                    padding: '4px',
                    border: '1px solid #1a73e8',
                    borderRadius: '2px',
                    fontFamily: 'inherit',
                    fontSize: '12px'
                  }}
                />
              </div>
            );
          }

          return (
            <div
              key={col.key}
              className="virtual-cell"
              style={{
                width: col.width || 150,
                textAlign: col.type === 'numeric' ? 'right' : 'left',
              }}
              title={formatCellValue(value, col.type)}
              onDoubleClick={() => startEditing(row.id, col.key, value)}
            >
              {formatCellValue(value, col.type)}
            </div>
          );
        })}
      </div>
    );
  };

  const itemCount = hasMore ? data.length + 100 : data.length;
  const isItemLoaded = (index: number) => !hasMore || index < data.length;

  return (
    <div className="virtual-table-container">
      <div className="virtual-table-header">
        {columns.map(col => (
          <div
            key={col.key}
            className="virtual-header-cell"
            style={{ width: col.width || 150, cursor: 'pointer' }}
            onClick={() => applySort(col.key, sort.direction === 'asc' ? 'desc' : 'asc')}
          >
            {col.label || col.key}
            {sort.column === col.key && (
              <span>{sort.direction === 'asc' ? ' ↑' : ' ↓'}</span>
            )}
          </div>
        ))}
      </div>
      <InfiniteLoader
        isItemLoaded={isItemLoaded}
        itemCount={itemCount}
        loadMoreItems={loadMoreRows}
        threshold={50}
      >
        {({ onItemsRendered, ref }) => (
          <List
            ref={ref}
            height={height}
            itemCount={itemCount}
            itemSize={rowHeight}
            onItemsRendered={onItemsRendered}
            width="100%"
          >
            {Row}
          </List>
        )}
      </InfiniteLoader>
      {loading && <div className="loading-overlay">Загрузка...</div>}
    </div>
  );
};

export default React.memo(VirtualTable);