// Временная база данных (mock data) для таблицы sales
// Позже заменим на реальные API запросы

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Данные для таблицы sales (продажи)
const mockSalesData = [
    {
        id: 1,
        sale_date: '2024-03-01',
        region: 'Москва',
        product_category: 'Электроника',
        product_name: 'Ноутбук Lenovo',
        quantity: 2,
        price: 45000.00,
        revenue: 90000.00,
        customer_id: 1001,
        payment_method: 'Банковская карта',
        discount: 5.00,
        extra_attributes: {
            brand: 'Lenovo',
            color: 'серый',
            warranty_months: 12
        }
    },
    {
        id: 2,
        sale_date: '2024-03-02',
        region: 'Санкт-Петербург',
        product_category: 'Смартфоны',
        product_name: 'iPhone 14',
        quantity: 1,
        price: 79999.00,
        revenue: 79999.00,
        customer_id: 1002,
        payment_method: 'Наличные',
        discount: 0,
        extra_attributes: {
            color: 'черный',
            memory: '128GB'
        }
    },
    {
        id: 3,
        sale_date: '2024-03-03',
        region: 'Москва',
        product_category: 'Аксессуары',
        product_name: 'Наушники Sony',
        quantity: 3,
        price: 5000.00,
        revenue: 15000.00,
        customer_id: 1003,
        payment_method: 'Банковская карта',
        discount: 10.00,
        extra_attributes: {
            type: 'wireless',
            noise_cancelling: true
        }
    },
    {
        id: 4,
        sale_date: '2024-03-04',
        region: 'Казань',
        product_category: 'Электроника',
        product_name: 'Планшет Samsung',
        quantity: 1,
        price: 35000.00,
        revenue: 35000.00,
        customer_id: 1004,
        payment_method: 'Онлайн-платеж',
        discount: 0,
        extra_attributes: {
            model: 'Tab S8',
            screen_size: '11"'
        }
    },
    {
        id: 5,
        sale_date: '2024-03-05',
        region: 'Москва',
        product_category: 'Смартфоны',
        product_name: 'Xiaomi Mi 11',
        quantity: 2,
        price: 30000.00,
        revenue: 60000.00,
        customer_id: 1005,
        payment_method: 'Банковская карта',
        discount: 7.50,
        extra_attributes: {
            ram: '8GB',
            storage: '128GB'
        }
    },
    {
        id: 6,
        sale_date: '2024-03-06',
        region: 'Новосибирск',
        product_category: 'Аксессуары',
        product_name: 'Клавиатура Logitech',
        quantity: 1,
        price: 3500.00,
        revenue: 3500.00,
        customer_id: 1006,
        payment_method: 'Наличные',
        discount: 0,
        extra_attributes: {
            type: 'mechanical',
            backlight: true
        }
    },
    {
        id: 7,
        sale_date: '2024-03-07',
        region: 'Москва',
        product_category: 'Электроника',
        product_name: 'Монитор Dell',
        quantity: 1,
        price: 25000.00,
        revenue: 25000.00,
        customer_id: 1007,
        payment_method: 'Банковская карта',
        discount: 15.00,
        extra_attributes: {
            resolution: '4K',
            size: '27"'
        }
    },
    {
        id: 8,
        sale_date: '2024-03-08',
        region: 'Екатеринбург',
        product_category: 'Смартфоны',
        product_name: 'Google Pixel 7',
        quantity: 1,
        price: 55000.00,
        revenue: 55000.00,
        customer_id: 1008,
        payment_method: 'Онлайн-платеж',
        discount: 0,
        extra_attributes: {
            color: 'белый',
            storage: '256GB'
        }
    },
    {
        id: 9,
        sale_date: '2024-03-09',
        region: 'Москва',
        product_category: 'Аксессуары',
        product_name: 'Мышь Logitech',
        quantity: 4,
        price: 1500.00,
        revenue: 6000.00,
        customer_id: 1009,
        payment_method: 'Наличные',
        discount: 0,
        extra_attributes: {
            wireless: true,
            dpi: 3200
        }
    },
    {
        id: 10,
        sale_date: '2024-03-10',
        region: 'Санкт-Петербург',
        product_category: 'Электроника',
        product_name: 'Ноутбук Asus',
        quantity: 1,
        price: 65000.00,
        revenue: 65000.00,
        customer_id: 1010,
        payment_method: 'Банковская карта',
        discount: 8.00,
        extra_attributes: {
            processor: 'Intel i7',
            ram: '16GB'
        }
    }
];

// Список доступных таблиц (пока только одна)
const getTablesList = () => {
    return [{ Tables_in_database: 'sales' }];
};

// Получение данных из таблицы sales
const getTableData = (tableName) => {
    if (tableName === 'sales') {
        return mockSalesData;
    }
    throw new Error(`Таблица "${tableName}" не найдена`);
};

// Получение структуры таблицы
const getTableStructure = (tableName) => {
    if (tableName === 'sales') {
        return [
            { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
            { column_name: 'sale_date', data_type: 'date', is_nullable: 'NO' },
            { column_name: 'region', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'product_category', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'product_name', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'quantity', data_type: 'integer', is_nullable: 'YES' },
            { column_name: 'price', data_type: 'numeric', is_nullable: 'YES' },
            { column_name: 'revenue', data_type: 'numeric', is_nullable: 'YES' },
            { column_name: 'customer_id', data_type: 'integer', is_nullable: 'YES' },
            { column_name: 'payment_method', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'discount', data_type: 'numeric', is_nullable: 'YES' },
            { column_name: 'extra_attributes', data_type: 'jsonb', is_nullable: 'YES' }
        ];
    }
    throw new Error(`Таблица "${tableName}" не найдена`);
};

// Добавление записи
const addRecord = (tableName, record) => {
    if (tableName !== 'sales') {
        throw new Error(`Таблица "${tableName}" не найдена`);
    }
    
    const newId = Math.max(...mockSalesData.map(item => item.id), 0) + 1;
    const newRecord = { 
        ...record, 
        id: newId,
        revenue: record.quantity * record.price * (1 - (record.discount || 0) / 100)
    };
    mockSalesData.push(newRecord);
    return newRecord;
};

// Обновление записи
const updateRecord = (tableName, id, updatedData) => {
    if (tableName !== 'sales') {
        throw new Error(`Таблица "${tableName}" не найдена`);
    }
    
    const index = mockSalesData.findIndex(item => item.id === parseInt(id));
    if (index === -1) {
        throw new Error(`Запись с id ${id} не найдена`);
    }
    
    // Пересчитываем revenue если изменились quantity, price или discount
    const current = mockSalesData[index];
    const newQuantity = updatedData.quantity !== undefined ? updatedData.quantity : current.quantity;
    const newPrice = updatedData.price !== undefined ? updatedData.price : current.price;
    const newDiscount = updatedData.discount !== undefined ? updatedData.discount : current.discount;
    
    const newRevenue = newQuantity * newPrice * (1 - newDiscount / 100);
    
    mockSalesData[index] = { 
        ...current, 
        ...updatedData,
        revenue: newRevenue
    };
    
    return mockSalesData[index];
};

// Удаление записи
const deleteRecord = (tableName, id) => {
    if (tableName !== 'sales') {
        throw new Error(`Таблица "${tableName}" не найдена`);
    }
    
    const index = mockSalesData.findIndex(item => item.id === parseInt(id));
    if (index === -1) {
        throw new Error(`Запись с id ${id} не найдена`);
    }
    
    mockSalesData.splice(index, 1);
    return { success: true, message: 'Запись удалена' };
};

// Поиск по таблице
const searchInTable = (tableName, searchTerm) => {
    const data = getTableData(tableName);
    if (!searchTerm) return data;
    
    return data.filter(row => {
        return Object.values(row).some(value => {
            if (value === null || value === undefined) return false;
            if (typeof value === 'object') return JSON.stringify(value).toLowerCase().includes(searchTerm.toLowerCase());
            return String(value).toLowerCase().includes(searchTerm.toLowerCase());
        });
    });
};

// Фильтрация по региону
const filterByRegion = (tableName, region) => {
    const data = getTableData(tableName);
    if (!region) return data;
    return data.filter(row => row.region === region);
};

// Фильтрация по категории
const filterByCategory = (tableName, category) => {
    const data = getTableData(tableName);
    if (!category) return data;
    return data.filter(row => row.product_category === category);
};

// Получение статистики
const getStatistics = () => {
    const totalRevenue = mockSalesData.reduce((sum, sale) => sum + sale.revenue, 0);
    const totalQuantity = mockSalesData.reduce((sum, sale) => sum + sale.quantity, 0);
    const uniqueRegions = [...new Set(mockSalesData.map(sale => sale.region))];
    const uniqueCategories = [...new Set(mockSalesData.map(sale => sale.product_category))];
    
    // Статистика по регионам
    const revenueByRegion = {};
    mockSalesData.forEach(sale => {
        revenueByRegion[sale.region] = (revenueByRegion[sale.region] || 0) + sale.revenue;
    });
    
    // Статистика по категориям
    const revenueByCategory = {};
    mockSalesData.forEach(sale => {
        revenueByCategory[sale.product_category] = (revenueByCategory[sale.product_category] || 0) + sale.revenue;
    });
    
    return {
        totalSales: mockSalesData.length,
        totalRevenue: totalRevenue,
        totalQuantity: totalQuantity,
        averageOrderValue: totalRevenue / mockSalesData.length,
        uniqueRegions: uniqueRegions.length,
        uniqueCategories: uniqueCategories.length,
        revenueByRegion: revenueByRegion,
        revenueByCategory: revenueByCategory,
        topProduct: mockSalesData.reduce((max, sale) => max.revenue > sale.revenue ? max : sale),
        paymentMethods: {
            card: mockSalesData.filter(s => s.payment_method === 'Банковская карта').length,
            cash: mockSalesData.filter(s => s.payment_method === 'Наличные').length,
            online: mockSalesData.filter(s => s.payment_method === 'Онлайн-платеж').length
        }
    };
};

// Mock API
class MockAPI {
    static async getTables() {
        await delay(500);
        return getTablesList();
    }
    
    static async getTableData(tableName) {
        await delay(300);
        return getTableData(tableName);
    }
    
    static async getTableStructure(tableName) {
        await delay(200);
        return getTableStructure(tableName);
    }
    
    static async addRecord(tableName, record) {
        await delay(400);
        return addRecord(tableName, record);
    }
    
    static async updateRecord(tableName, id, updatedData) {
        await delay(400);
        return updateRecord(tableName, id, updatedData);
    }
    
    static async deleteRecord(tableName, id) {
        await delay(300);
        return deleteRecord(tableName, id);
    }
    
    static async searchInTable(tableName, searchTerm) {
        await delay(200);
        return searchInTable(tableName, searchTerm);
    }
    
    static async filterByRegion(tableName, region) {
        await delay(200);
        return filterByRegion(tableName, region);
    }
    
    static async filterByCategory(tableName, category) {
        await delay(200);
        return filterByCategory(tableName, category);
    }
    
    static async getStatistics() {
        await delay(600);
        return getStatistics();
    }
}

export default MockAPI;