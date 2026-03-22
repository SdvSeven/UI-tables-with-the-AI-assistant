import React, { useState, useEffect } from 'react';
import { VirtualTable, FilterPanel, ViewManager, AIPanel, FormulaBar } from '@components';
import { api } from '@services';
import { useDataQuery } from '@hooks';
import '@styles';

interface Column {
  key: string;
  label: string;
  type: string;
  width?: number;
}

const App: React.FC = () => {
  const [columns, setColumns] = useState<Column[]>([]);
  const [showAIPanel, setShowAIPanel] = useState(true);
  const [showFiltersPanel, setShowFiltersPanel] = useState(true);
  const [showFormulasPanel, setShowFormulasPanel] = useState(false);
  const [showSavedViewsPanel, setShowSavedViewsPanel] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    rowId: number | null;
    column: string | null;
    value: string;
  }>({ rowId: null, column: null, value: '' });

  const { data, loading, sort, filters, applyFilters, applySort, updateRecord } = useDataQuery();

  useEffect(() => {
    api.getTableStructure()
      .then(setColumns)
      .catch(err => {
        console.error('Failed to load columns:', err);
        setColumns([]);
      });
  }, []);

  const handleSaveFormula = async (rowId: number, column: string, newValue: string) => {
    await updateRecord(rowId, { [column]: newValue });
    setEditingCell({ rowId: null, column: null, value: '' });
  };

  const handleCancelFormula = () => setEditingCell({ rowId: null, column: null, value: '' });
  const handleCellSelect = (rowId: number, column: string, value: string) =>
    setEditingCell({ rowId, column, value });

  return (
    <div className="app">
      <header className="app-header">
        <h1>Analytics Platform</h1>
        <div className="toolbar">
          <button
            className={`toolbar-button ${showFiltersPanel ? 'active' : ''}`}
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
          >
            Filters
          </button>
          <button
            className={`toolbar-button ${showFormulasPanel ? 'active' : ''}`}
            onClick={() => setShowFormulasPanel(!showFormulasPanel)}
          >
            Formulas
          </button>
          <button
            className={`toolbar-button ${showSavedViewsPanel ? 'active' : ''}`}
            onClick={() => setShowSavedViewsPanel(!showSavedViewsPanel)}
          >
            Saved Views
          </button>
          <button className="toolbar-button" onClick={() => setShowAIPanel(!showAIPanel)}>
            {showAIPanel ? 'Hide AI' : 'Show AI'}
          </button>
        </div>
      </header>
      <div className="main-content">
        {showFiltersPanel && (
          <div className="filters-section">
            <FilterPanel columns={columns} filters={filters} applyFilters={applyFilters} />
          </div>
        )}
        {showFormulasPanel && (
          <div className="formula-section">
            <FormulaBar
              rowId={editingCell.rowId}
              column={editingCell.column}
              initialValue={editingCell.value}
              onSave={handleSaveFormula}
              onCancel={handleCancelFormula}
            />
          </div>
        )}
        <div className="data-section" style={{ display: 'flex', gap: '20px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <VirtualTable
              columns={columns}
              data={data}
              loading={loading}
              sort={sort}
              applySort={applySort}
              onCellSelect={handleCellSelect}
              height={600}
            />
          </div>
          {showAIPanel && (
            <div className="ai-sidebar" style={{ width: '350px', flexShrink: 0 }}>
              <AIPanel />
            </div>
          )}
        </div>
        {showSavedViewsPanel && (
          <div className="saved-views-section">
            <ViewManager />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;