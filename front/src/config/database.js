const API_BASE_URL = 'http://localhost:5000/api';

export const API_ENDPOINTS = {
    TABLES: `${API_BASE_URL}/tables`,
    TABLE_DATA: (tableName) => `${API_BASE_URL}/table/${tableName}`,
};

export default API_BASE_URL;