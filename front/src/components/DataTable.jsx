import React, { useState, useRef, useEffect } from 'react';
import { useDataFetch } from '../hooks/useDataFetch';
import { formatCurrency, formatDate } from '../utils/helpers';
import '../styles/DataTable.css';

function DataTable() {
    const {
        data,
        columns,
        tables,
        selectedTable,
        setSelectedTable,
        loading,
        error,
        statistics,
        addRecord,
        updateRecord,
        deleteRecord,
        searchRecords,
    } = useDataFetch();

    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ column: null, direction: 'asc' });
    const [regionFilter, setRegionFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [editingCell, setEditingCell] = useState({ rowId: null, column: null });
    const [editValue, setEditValue] = useState('');
    const [jsonModal, setJsonModal] = useState({ isOpen: false, rowId: null, column: null, value: '' });
    const inputRef = useRef(null);

    // Фокус на поле ввода при редактировании
    useEffect(() => {
        if (editingCell.rowId !== null && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingCell]);

    if (loading) return <div className="loading">Загрузка данных...</div>;
    if (error) return <div className="error">Ошибка: {error}</div>;

    // Получаем уникальные регионы и категории
    const uniqueRegions = [...new Set(data.map(item => item.region).filter(Boolean))];
    const uniqueCategories = [...new Set(data.map(item => item.product_category).filter(Boolean))];

    // Фильтрация данных
    let filteredData = [...data];
    
    if (searchTerm) {
        filteredData = filteredData.filter(row => {
            return Object.values(row).some(value => {
                if (value === null || value === undefined) return false;
                if (typeof value === 'object') {
                    return JSON.stringify(value).toLowerCase().includes(searchTerm.toLowerCase());
                }
                return String(value).toLowerCase().includes(searchTerm.toLowerCase());
            });
        });
    }
    
    if (regionFilter) {
        filteredData = filteredData.filter(item => item.region === regionFilter);
    }
    
    if (categoryFilter) {
        filteredData = filteredData.filter(item => item.product_category === categoryFilter);
    }
    
    // Сортировка
    if (sortConfig.column) {
        filteredData.sort((a, b) => {
            let aVal = a[sortConfig.column];
            let bVal = b[sortConfig.column];
            
            if (aVal === null) return 1;
            if (bVal === null) return -1;
            
            if (typeof aVal === 'object') {
                aVal = JSON.stringify(aVal);
                bVal = JSON.stringify(bVal);
            }
            
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
            }
            
            const comparison = String(aVal).localeCompare(String(bVal));
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    }

    const handleSort = (column) => {
        setSortConfig(prev => ({
            column,
            direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const handleTableChange = (e) => {
        setSelectedTable(e.target.value);
        setSearchTerm('');
        setRegionFilter('');
        setCategoryFilter('');
        setSortConfig({ column: null, direction: 'asc' });
        setEditingCell({ rowId: null, column: null });
    };

    const handleSearch = (e) => {
        const term = e.target.value;
        setSearchTerm(term);
        if (term) {
            searchRecords(term);
        }
    };

    const handleAddRow = async () => {
        const newRow = {
            sale_date: new Date().toISOString().split('T')[0],
            region: '',
            product_category: '',
            product_name: '',
            quantity: 1,
            price: 0,
            customer_id: 0,
            payment_method: '',
            discount: 0,
            extra_attributes: {}
        };
        
        try {
            await addRecord(newRow);
        } catch (err) {
            alert('Ошибка при добавлении строки');
        }
    };

    const handleDeleteRow = async (id) => {
        if (window.confirm('Удалить эту запись?')) {
            try {
                await deleteRecord(id);
            } catch (err) {
                alert('Ошибка при удалении');
            }
        }
    };

    const startEditing = (rowId, column, value) => {
        let displayValue = value;
        if (typeof value === 'object') {
            displayValue = JSON.stringify(value, null, 2);
        } else if (value === null) {
            displayValue = '';
        } else {
            displayValue = String(value);
        }
        
        setEditingCell({ rowId, column });
        setEditValue(displayValue);
    };

    const saveEdit = async (rowId, column) => {
        const originalRow = data.find(row => row.id === rowId);
        if (!originalRow) return;
        
        let newValue = editValue;
        
        // Преобразование типов
        if (column === 'quantity' || column === 'customer_id') {
            newValue = parseInt(editValue) || 0;
        } else if (column === 'price' || column === 'discount') {
            newValue = parseFloat(editValue) || 0;
        } else if (column === 'extra_attributes') {
            try {
                newValue = JSON.parse(editValue);
            } catch (e) {
                alert('Неверный формат JSON');
                setEditingCell({ rowId: null, column: null });
                return;
            }
        }
        
        try {
            await updateRecord(rowId, { [column]: newValue });
        } catch (err) {
            alert('Ошибка при сохранении');
        }
        
        setEditingCell({ rowId: null, column: null });
    };

    const handleKeyDown = (e, rowId, column) => {
        if (e.key === 'Enter') {
            saveEdit(rowId, column);
        } else if (e.key === 'Escape') {
            setEditingCell({ rowId: null, column: null });
        }
    };

    const openJsonModal = (rowId, column, value) => {
        const jsonStr = typeof value === 'object' ? JSON.stringify(value, null, 2) : value || '{}';
        setJsonModal({ isOpen: true, rowId, column, value: jsonStr });
    };

    const saveJsonModal = async () => {
        try {
            const parsedValue = JSON.parse(jsonModal.value);
            await updateRecord(jsonModal.rowId, { [jsonModal.column]: parsedValue });
            setJsonModal({ isOpen: false, rowId: null, column: null, value: '' });
        } catch (e) {
            alert('Неверный формат JSON');
        }
    };

    const formatCellValue = (value, column) => {
        if (value === null || value === undefined) {
            return <span className="cell-value-null">—</span>;
        }
        
        if (column === 'sale_date') {
            return formatDate(value);
        }
        
        if (column === 'price' || column === 'revenue') {
            return <span className="cell-value-number">{formatCurrency(value)}</span>;
        }
        
        if (column === 'discount') {
            return <span className="cell-value-number">{value}%</span>;
        }
        
        if (typeof value === 'object') {
            return (
                <span 
                    className="cell-value-json" 
                    onClick={() => openJsonModal(null, column, value)}
                >
                    JSON
                </span>
            );
        }
        
        if (typeof value === 'number') {
            return <span className="cell-value-number">{value.toLocaleString('ru-RU')}</span>;
        }
        
        return value;
    };

    const renderCell = (row, column) => {
        const isEditing = editingCell.rowId === row.id && editingCell.column === column;
        const value = row[column];
        
        if (isEditing) {
            return (
                <input
                    ref={inputRef}
                    type="text"
                    className="cell-input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => saveEdit(row.id, column)}
                    onKeyDown={(e) => handleKeyDown(e, row.id, column)}
                />
            );
        }
        
        return (
            <div 
                className="editable-cell cell-value"
                onDoubleClick={() => startEditing(row.id, column, value)}
            >
                {formatCellValue(value, column)}
            </div>
        );
    };

    return (
        <div className="data-table-container">
            <div className="header">
                <h1>Sales Data</h1>
                <p>Аналитика продаж и управление данными</p>
            </div>

            {statistics && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-label">Всего продаж</div>
                        <div className="stat-value">{statistics.totalSales}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Общая выручка</div>
                        <div className="stat-value">{formatCurrency(statistics.totalRevenue)}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Средний чек</div>
                        <div className="stat-value">{formatCurrency(statistics.averageOrderValue)}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Всего товаров</div>
                        <div className="stat-value">{statistics.totalQuantity}</div>
                    </div>
                </div>
            )}

            <div className="toolbar">
                <div className="toolbar-group">
                    <select className="toolbar-select" value={selectedTable} onChange={handleTableChange}>
                        {tables.map(table => (
                            <option key={table} value={table}>{table}</option>
                        ))}
                    </select>
                    <button className="toolbar-button" onClick={handleAddRow}>
                        Добавить строку
                    </button>
                </div>
                <div className="toolbar-group">
                    <input
                        type="text"
                        className="toolbar-input"
                        placeholder="Поиск..."
                        value={searchTerm}
                        onChange={handleSearch}
                    />
                </div>
            </div>

            <div className="filters">
                <select 
                    className="filter-select" 
                    value={regionFilter} 
                    onChange={(e) => setRegionFilter(e.target.value)}
                >
                    <option value="">Все регионы</option>
                    {uniqueRegions.map(region => (
                        <option key={region} value={region}>{region}</option>
                    ))}
                </select>
                
                <select 
                    className="filter-select" 
                    value={categoryFilter} 
                    onChange={(e) => setCategoryFilter(e.target.value)}
                >
                    <option value="">Все категории</option>
                    {uniqueCategories.map(category => (
                        <option key={category} value={category}>{category}</option>
                    ))}
                </select>
                
                {(regionFilter || categoryFilter) && (
                    <button 
                        className="reset-button"
                        onClick={() => { setRegionFilter(''); setCategoryFilter(''); }}
                    >
                        Сбросить
                    </button>
                )}
            </div>

            <div className="sheets-table-wrapper">
                <table className="sheets-table">
                    <thead>
                        <tr>
                            {columns.map(column => (
                                <th key={column} onClick={() => handleSort(column)}>
                                    {column}
                                    {sortConfig.column === column && (
                                        <span className="sort-indicator">
                                            {sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                                        </span>
                                    )}
                                </th>
                            ))}
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: '48px' }}>
                                    Нет данных
                                </td>
                            </tr>
                        ) : (
                            filteredData.map((row) => (
                                <tr key={row.id}>
                                    {columns.map(column => (
                                        <td key={column}>
                                            {renderCell(row, column)}
                                        </td>
                                    ))}
                                    <td className="action-buttons">
                                        <button 
                                            className="action-button delete"
                                            onClick={() => handleDeleteRow(row.id)}
                                        >
                                            Удалить
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="table-info">
                Показано {filteredData.length} из {data.length} записей
            </div>

            {jsonModal.isOpen && (
                <div className="modal-overlay" onClick={() => setJsonModal({ isOpen: false, rowId: null, column: null, value: '' })}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Редактировать JSON</h3>
                        <textarea
                            value={jsonModal.value}
                            onChange={(e) => setJsonModal({ ...jsonModal, value: e.target.value })}
                        />
                        <div className="modal-buttons">
                            <button className="modal-button" onClick={() => setJsonModal({ isOpen: false, rowId: null, column: null, value: '' })}>
                                Отмена
                            </button>
                            <button className="modal-button primary" onClick={saveJsonModal}>
                                Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DataTable;