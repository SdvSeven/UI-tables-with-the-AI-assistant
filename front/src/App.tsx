import React, { useState, useEffect } from 'react';
import { VirtualTable, FilterPanel, AggregationBar, ViewManager, AIPanel } from '@components';
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

  useEffect(() => {
    api.getTableStructure()
      .then(setColumns)
      .catch(err => {
        console.error('Failed to load columns:', err);
        setColumns([]);
      });
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Аналитическая платформа </h1>
        <div className="toolbar">
          <ViewManager />
          <button onClick={() => setShowAIPanel(!showAIPanel)}>
            {showAIPanel ? 'Скрыть AI' : 'Показать AI'}
          </button>
        </div>
      </header>
      <div className="main-content">
        <div className="filters-section">
          <FilterPanel columns={columns} />
          <AggregationBar columns={columns} />
        </div>
        <div className="data-section" style={{ display: 'flex', gap: '20px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <VirtualTable columns={columns} height={600} />
          </div>
          {showAIPanel && (
            <div className="ai-sidebar" style={{ width: '350px', flexShrink: 0 }}>
              <AIPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;