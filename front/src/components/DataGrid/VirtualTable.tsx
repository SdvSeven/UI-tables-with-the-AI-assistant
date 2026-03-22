import React, { useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { api } from '@services';

interface Column {
  key: string;
  label: string;
  type: string;
  width?: number;
}

interface VirtualTableProps {
  columns: Column[];
  data: any[];
  loading: boolean;
  sort: { column: string | null; direction: 'asc' | 'desc' };
  applySort: (column: string, direction: 'asc' | 'desc') => void;
  loadMore: () => void;
  hasMore: boolean;
  onCellSelect?: (rowId: number, column: string, value: string) => void;
  height?: number;
  rowHeight?: number;
  overscanCount?: number;
}

const VirtualTable: React.FC<VirtualTableProps> = ({
  columns,
  data,
  loading,
  sort,
  applySort,
  loadMore,
  hasMore,
  onCellSelect,
  height = 500,
  rowHeight = 32,
  overscanCount = 5,
}) => {
  if (!columns || !Array.isArray(columns)) return null;

  const [selectedCell, setSelectedCell] = useState<{
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
    if (onCellSelect) onCellSelect(rowId, column, displayValue);
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

  const LoadingRow = ({ style }: { style: React.CSSProperties }) => (
    <div style={style} className="virtual-row loading-row">
      <div style={{ width: '100%', textAlign: 'center', padding: '8px', color: '#5f6368' }}>
        Loading...
      </div>
    </div>
  );

  const RowRenderer = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    if (index < data.length) {
      return <Row index={index} style={style} />;
    } else {
      return <LoadingRow style={style} />;
    }
  };

  const itemCount = hasMore ? data.length + 1 : data.length;

  const handleItemsRendered = ({
    visibleStopIndex,
  }: {
    visibleStopIndex: number;
    overscanStopIndex?: number;
  }) => {
    // Если мы приблизились к концу загруженных данных (осталось меньше 15 строк до конца)
    // и есть ещё данные для загрузки, и не идёт активная загрузка, то загружаем следующую страницу.
    if (hasMore && !loading && visibleStopIndex >= data.length - 15) {
      loadMore();
    }
  };

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
      <List
        height={height}
        itemCount={itemCount}
        itemSize={rowHeight}
        overscanCount={overscanCount}
        onItemsRendered={handleItemsRendered}
        width="100%"
      >
        {RowRenderer}
      </List>
      {loading && <div className="loading-overlay">Loading...</div>}
    </div>
  );
};

export default React.memo(VirtualTable);