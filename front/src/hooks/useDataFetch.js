import { useState, useEffect } from 'react';
import DataService from '../services/api'; // Импортируем класс, а не отдельные функции

export const useDataFetch = () => {
    const [data, setData] = useState([]);
    const [columns, setColumns] = useState([]);
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statistics, setStatistics] = useState(null);

    // Загрузка списка таблиц
    useEffect(() => {
        const fetchTables = async () => {
            try {
                console.log('Загрузка списка таблиц...');
                const tablesData = await DataService.getTables(); // Используем DataService.getTables()
                console.log('Получены таблицы:', tablesData);
                const tableNames = tablesData.map(item => Object.values(item)[0]);
                setTables(tableNames);
                if (tableNames.length > 0) {
                    setSelectedTable(tableNames[0]);
                }
            } catch (err) {
                console.error('Ошибка загрузки таблиц:', err);
                setError('Не удалось загрузить список таблиц');
            }
        };

        fetchTables();
        
        // Загрузка статистики
        const fetchStatistics = async () => {
            try {
                const stats = await DataService.getStatistics();
                setStatistics(stats);
            } catch (err) {
                console.error('Не удалось загрузить статистику:', err);
            }
        };
        
        fetchStatistics();
    }, []);

    // Загрузка данных выбранной таблицы
    useEffect(() => {
        if (!selectedTable) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                console.log(`Загрузка данных из таблицы ${selectedTable}...`);
                const tableData = await DataService.getTableData(selectedTable);
                console.log(`Получено ${tableData.length} записей`);
                setData(tableData);
                
                if (tableData.length > 0) {
                    setColumns(Object.keys(tableData[0]));
                } else {
                    setColumns([]);
                }
                setError(null);
            } catch (err) {
                console.error(`Ошибка загрузки данных из ${selectedTable}:`, err);
                setError(`Ошибка загрузки данных из таблицы ${selectedTable}`);
                setData([]);
                setColumns([]);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedTable]);

    // Методы для работы с данными
    const addRecord = async (record) => {
        try {
            const newRecord = await DataService.addRecord(selectedTable, record);
            setData(prev => [...prev, newRecord]);
            return newRecord;
        } catch (err) {
            console.error('Ошибка добавления:', err);
            throw err;
        }
    };

    const updateRecord = async (id, updatedData) => {
        try {
            const updated = await DataService.updateRecord(selectedTable, id, updatedData);
            setData(prev => prev.map(item => item.id === id ? updated : item));
            return updated;
        } catch (err) {
            console.error('Ошибка обновления:', err);
            throw err;
        }
    };

    const deleteRecord = async (id) => {
        try {
            await DataService.deleteRecord(selectedTable, id);
            setData(prev => prev.filter(item => item.id !== id));
        } catch (err) {
            console.error('Ошибка удаления:', err);
            throw err;
        }
    };

    const searchRecords = async (searchTerm) => {
        setLoading(true);
        try {
            const results = await DataService.searchInTable(selectedTable, searchTerm);
            setData(results);
        } catch (err) {
            console.error('Ошибка поиска:', err);
        } finally {
            setLoading(false);
        }
    };

    return {
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
    };
};