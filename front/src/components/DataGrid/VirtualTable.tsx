import React from 'react';
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
  onCellSelect?: (rowId: number, column: string, value: string) => void;
}

const VirtualTable: React.FC<VirtualTableProps> = ({ columns, height = 500, rowHeight = 32, onCellSelect }) => {
  if (!columns || !Array.isArray(columns)) return null;

  const { data, hasMore, loading, sort, applySort, loadMoreRows } = useDataQuery();

  const [selectedCell, setSelectedCell] = React.useState<{
    rowId: number | null;
    column: string | null;
    initialValue: string;
  }>({ rowId: null, column: null, initialValue: '' });

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

  const selectCell = async (rowId: number, column: string, currentValue: any) => {
    let formula: string | null = null;
    try {
      formula = await api.getCellFormula(rowId, column);
    } catch (err) {
      console.warn('Failed to fetch formula', err);
    }
    const displayValue = formula !== null ? formula : (currentValue !== undefined ? String(currentValue) : '');
    setSelectedCell({ rowId, column, initialValue: displayValue });
    if (onCellSelect) {
      onCellSelect(rowId, column, displayValue);
    }
  };

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const row = data[index];
    if (!row) return null;

    const isSelected = selectedCell.rowId === row.id;
    return (
      <div style={style} className="virtual-row">
        {columns.map(col => {
          const value = row[col.key];
          const isSelectedCell = isSelected && selectedCell.column === col.key;
          return (
            <div
              key={col.key}
              className={`virtual-cell ${isSelectedCell ? 'selected-cell' : ''}`}
              style={{
                width: col.width || 150,
                textAlign: col.type === 'numeric' ? 'right' : 'left',
                cursor: 'pointer',
              }}
              title={formatCellValue(value, col.type)}
              onDoubleClick={() => selectCell(row.id, col.key, value)}
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
      {/* @ts-ignore */}
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