// Переключатель: true - использовать mock данные, false - реальный API
const USE_MOCK = true; // Убедитесь, что здесь true

// Импорт mock API
import MockAPI from './mockData';

// Реальный API (будет использоваться когда USE_MOCK = false)
import axios from 'axios';
import API_BASE_URL, { API_ENDPOINTS } from '../config/database';

// Создаем единый интерфейс для работы с данными
class DataService {
    // Получить список таблиц
    static async getTables() {
        if (USE_MOCK) {
            console.log('Использую mock данные для получения таблиц');
            return await MockAPI.getTables();
        } else {
            try {
                console.log('Пытаюсь подключиться к реальному API');
                const response = await axios.get(API_ENDPOINTS.TABLES);
                return response.data;
            } catch (error) {
                console.error('Ошибка получения таблиц:', error);
                throw error;
            }
        }
    }
    
    // Получить данные из таблицы
    static async getTableData(tableName) {
        if (USE_MOCK) {
            console.log(`Использую mock данные для таблицы ${tableName}`);
            return await MockAPI.getTableData(tableName);
        } else {
            try {
                const response = await axios.get(API_ENDPOINTS.TABLE_DATA(tableName));
                return response.data;
            } catch (error) {
                console.error(`Ошибка получения данных из ${tableName}:`, error);
                throw error;
            }
        }
    }
    
    // Добавить запись
    static async addRecord(tableName, record) {
        if (USE_MOCK) {
            return await MockAPI.addRecord(tableName, record);
        } else {
            try {
                const response = await axios.post(API_ENDPOINTS.TABLE_DATA(tableName), record);
                return response.data;
            } catch (error) {
                console.error('Ошибка добавления записи:', error);
                throw error;
            }
        }
    }
    
    // Обновить запись
    static async updateRecord(tableName, id, updatedData) {
        if (USE_MOCK) {
            return await MockAPI.updateRecord(tableName, id, updatedData);
        } else {
            try {
                const response = await axios.put(`${API_ENDPOINTS.TABLE_DATA(tableName)}/${id}`, updatedData);
                return response.data;
            } catch (error) {
                console.error('Ошибка обновления записи:', error);
                throw error;
            }
        }
    }
    
    // Удалить запись
    static async deleteRecord(tableName, id) {
        if (USE_MOCK) {
            return await MockAPI.deleteRecord(tableName, id);
        } else {
            try {
                const response = await axios.delete(`${API_ENDPOINTS.TABLE_DATA(tableName)}/${id}`);
                return response.data;
            } catch (error) {
                console.error('Ошибка удаления записи:', error);
                throw error;
            }
        }
    }
    
    // Поиск
    static async searchInTable(tableName, searchTerm) {
        if (USE_MOCK) {
            return await MockAPI.searchInTable(tableName, searchTerm);
        } else {
            try {
                const response = await axios.get(`${API_ENDPOINTS.TABLE_DATA(tableName)}/search?q=${searchTerm}`);
                return response.data;
            } catch (error) {
                console.error('Ошибка поиска:', error);
                throw error;
            }
        }
    }
    
    // Получить статистику
    static async getStatistics() {
        if (USE_MOCK) {
            return await MockAPI.getStatistics();
        } else {
            try {
                const response = await axios.get(`${API_BASE_URL}/statistics`);
                return response.data;
            } catch (error) {
                console.error('Ошибка получения статистики:', error);
                throw error;
            }
        }
    }
}

export default DataService;