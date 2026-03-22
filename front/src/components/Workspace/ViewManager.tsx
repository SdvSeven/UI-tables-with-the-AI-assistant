import React, { useState, useEffect } from 'react';
import { api } from '@services';
import { useDataQuery } from '@hooks';

const ViewManager: React.FC = () => {
    const [views, setViews] = useState<any[]>([]);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [showViewsList, setShowViewsList] = useState(false);
    const [viewName, setViewName] = useState('');
    const { filters, groupBy, aggregations, sort, applyFilters, applyGroupBy, applyAggregations, applySort } = useDataQuery();

    useEffect(() => {
        loadViews();
    }, []);

    const loadViews = async () => {
        const saved = await api.getViews();
        setViews(saved);
    };

    const saveCurrentView = async () => {
        if (!viewName.trim()) return;
        const newView = {
            id: Date.now(),
            name: viewName,
            filters,
            groupBy,
            aggregations,
            sort,
            createdAt: new Date().toISOString()
        };
        await api.saveView(newView);
        await loadViews();
        setShowSaveDialog(false);
        setViewName('');
        setShowViewsList(false);
    };

    const loadView = (view: any) => {
        applyFilters(view.filters);
        applyGroupBy(view.groupBy);
        applyAggregations(view.aggregations);
        if (view.sort) applySort(view.sort.column, view.sort.direction);
        setShowViewsList(false);
    };

    const deleteView = async (id: number) => {
        await api.deleteView(id);
        await loadViews();
    };

    const toggleViewsList = () => {
        setShowViewsList(!showViewsList);
        setShowSaveDialog(false);
    };

    const openSaveDialog = () => {
        setShowSaveDialog(true);
        setShowViewsList(false);
    };

    return (
        <div className="view-manager">
            <div className="view-manager-buttons">
                <button className="view-manager-button" onClick={openSaveDialog}>
                    Сохранить срез
                </button>
                <button className="view-manager-button" onClick={toggleViewsList}>
                    Мои срезы
                </button>
            </div>

            {showSaveDialog && (
                <div className="save-dialog">
                    <input
                        type="text"
                        placeholder="Название среза"
                        value={viewName}
                        onChange={(e) => setViewName(e.target.value)}
                    />
                    <button onClick={saveCurrentView}>Сохранить</button>
                    <button onClick={() => setShowSaveDialog(false)}>Отмена</button>
                </div>
            )}

            {showViewsList && (
                <div className="views-list">
                    <h4>Сохранённые срезы</h4>
                    {views.length === 0 ? (
                        <p>Нет сохранённых срезов</p>
                    ) : (
                        views.map(view => (
                            <div key={view.id} className="view-item">
                                <span>{view.name}</span>
                                <div>
                                    <button onClick={() => loadView(view)}>Загрузить</button>
                                    <button onClick={() => deleteView(view.id)}>Удалить</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default ViewManager;