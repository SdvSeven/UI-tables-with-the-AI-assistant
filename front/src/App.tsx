import React, { useState, useEffect } from 'react';
import { VirtualTable, FilterPanel, AggregationBar, ViewManager, FormulaBar } from '@components';
import AIQueryPanel from './components/AI/AIQueryPanel'; // импортируем новую панель
import { api } from '@services';
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
  }>({
    rowId: null,
    column: null,
    value: '',
  });

  useEffect(() => {
    api.getTableStructure()
      .then(setColumns)
      .catch(err => {
        console.error('Failed to load columns:', err);
        setColumns([]);
      });
  }, []);

  const handleSaveFormula = async (rowId: number, column: string, newValue: string) => {
    console.log('Save formula', rowId, column, newValue);
    setEditingCell({ rowId: null, column: null, value: '' });
  };

  const handleCancelFormula = () => {
    setEditingCell({ rowId: null, column: null, value: '' });
  };

  const handleCellSelect = (rowId: number, column: string, value: string) => {
    setEditingCell({ rowId, column, value });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Аналитическая платформа</h1>
        <div className="toolbar">
          <button
            className={`toolbar-button ${showFiltersPanel ? 'active' : ''}`}
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
          >
            Фильтры
          </button>
          <button
            className={`toolbar-button ${showFormulasPanel ? 'active' : ''}`}
            onClick={() => setShowFormulasPanel(!showFormulasPanel)}
          >
            Формулы
          </button>
          <button
            className={`toolbar-button ${showSavedViewsPanel ? 'active' : ''}`}
            onClick={() => setShowSavedViewsPanel(!showSavedViewsPanel)}
          >
            Сохранённые срезы
          </button>
          <button className="toolbar-button" onClick={() => setShowAIPanel(!showAIPanel)}>
            {showAIPanel ? 'Скрыть AI' : 'Показать AI'}
          </button>
        </div>
      </header>
      <div className="main-content">
        {showFiltersPanel && (
          <div className="filters-section">
            <FilterPanel columns={columns} />
            <AggregationBar columns={columns} />
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
            <VirtualTable columns={columns} height={600} onCellSelect={handleCellSelect} />
          </div>
          {showAIPanel && (
            <div className="ai-sidebar" style={{ width: '350px', flexShrink: 0 }}>
              <AIQueryPanel />  {/* вместо старого AIPanel */}
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