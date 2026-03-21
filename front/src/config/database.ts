export const API_BASE_URL = 'http://localhost:8080/api';

export const API_ENDPOINTS = {
    TABLES: `${API_BASE_URL}/tables`,
    TABLE_DATA: (tableName: string) => `${API_BASE_URL}/table/${tableName}`,
    QUERY: `${API_BASE_URL}/query`,
    STRUCTURE: `${API_BASE_URL}/structure`,
    VIEWS: `${API_BASE_URL}/views`,
};