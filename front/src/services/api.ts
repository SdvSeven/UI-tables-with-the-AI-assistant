const API_BASE = 'http://172.24.148.116:8080/api';

class ApiService {
  // Преобразование фильтров в параметры, ожидаемые бэкендом
  private buildFilterParams(filters: Record<string, any>): Record<string, string> {
    const params: Record<string, string> = {};

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === '') continue;

      switch (key) {
        case 'sale_date':
          // Бэкенд ожидает startDate и endDate
          params['startDate'] = String(value);
          params['endDate'] = String(value);
          break;

        case 'revenue':
          // Поддержка диапазона: "1000-5000" → minRevenue=1000, maxRevenue=5000
          // Одно число → minRevenue=число
          if (typeof value === 'string' && value.includes('-')) {
            const [min, max] = value.split('-');
            if (min) params['minRevenue'] = min.trim();
            if (max) params['maxRevenue'] = max.trim();
          } else {
            params['minRevenue'] = String(value);
          }
          break;

        case 'product_category':
          params['productCategory'] = String(value);
          break;

        case 'product_name':
          params['productName'] = String(value);
          break;

        case 'payment_method':
          params['paymentMethod'] = String(value);
          break;

        case 'customer_id':
          params['customerId'] = String(value);
          break;

        default:
          // id, region, quantity, price, discount, extra_attributes
          // передаются как есть (ключ уже snake_case, бэкенд их принимает)
          params[key] = String(value);
      }
    }
    return params;
  }

  // Получение общего количества записей с учётом фильтров
  async getTotalRows(filters: Record<string, any> = {}): Promise<number> {
    const filterParams = this.buildFilterParams(filters);
    const urlParams = new URLSearchParams(filterParams);
    const url = `${API_BASE}/sales/count?${urlParams.toString()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Ошибка получения count: ${response.status}`);
    const data = await response.json();
    return data.count;
  }

  // Основной метод запроса данных
  async query(
    params: {
      offset?: number;
      limit?: number;
      filters?: Record<string, any>;
      sort?: { column: string; direction: 'asc' | 'desc' };
    },
    signal?: AbortSignal,
  ) {
    const { offset = 0, limit = 100, filters = {}, sort } = params;

    // Фильтры
    const filterParams = this.buildFilterParams(filters);
    const urlParams = new URLSearchParams(filterParams);
    urlParams.append('offset', String(offset));
    urlParams.append('limit', String(limit));

    // Сортировка
    if (sort?.column) {
      urlParams.append('sort', sort.column);
      urlParams.append('order', sort.direction);
    }

    const url = `${API_BASE}/sales?${urlParams.toString()}`;
    console.log('Query URL:', url);

    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Ошибка запроса: ${response.status}`);

    const rows = await response.json(); // ожидаем массив
    const total = await this.getTotalRows(filters);

    return { data: rows, total, offset, limit };
  }

  // Получение структуры таблицы (поля и типы)
  async getTableStructure(): Promise<{ key: string; label: string; type: string; width: number }[]> {
    const response = await fetch(`${API_BASE}/fields`);
    if (!response.ok) throw new Error('Не удалось получить структуру');
    const fields = await response.json();
    return fields.map((field: any) => ({
      key: field.name,
      label: field.name,
      type: field.type === 'numeric' ? 'numeric' : 'string',
      width: 150,
    }));
  }

  // Получение одной записи по ID
  async getRecordById(id: number): Promise<Record<string, any>> {
    const response = await fetch(`${API_BASE}/sales/${id}`);
    if (!response.ok) throw new Error(`Запись ${id} не найдена`);
    return await response.json();
  }

  // Обновление записи (PUT)
  async updateRecord(id: number, updates: Record<string, any>) {
    const current = await this.getRecordById(id);
    const updatedRecord = { ...current, ...updates };
    const response = await fetch(`${API_BASE}/sales/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedRecord),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка обновления: ${response.status} – ${errorText}`);
    }
    return updatedRecord;
  }

  // Создание новой записи
  async createRecord(record: Record<string, any>) {
    const response = await fetch(`${API_BASE}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (!response.ok) throw new Error(`Ошибка создания: ${response.status}`);
    return await response.json();
  }

  // Удаление записи
  async deleteRecord(id: number) {
    const response = await fetch(`${API_BASE}/sales/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`Ошибка удаления: ${response.status}`);
    return true;
  }

  // Заглушки для формул и AI
  async getCellFormula(id: number, column: string): Promise<string | null> {
    return null;
  }

  async sendAIQuery(query: string, context: any): Promise<string> {
    return `(Заглушка) Ваш запрос: "${query}"`;
  }

  // Сохранение срезов в localStorage
  async saveView(view: any) {
    const views = JSON.parse(localStorage.getItem('saved_views') || '[]');
    views.push(view);
    localStorage.setItem('saved_views', JSON.stringify(views));
    return view;
  }

  async getViews() {
    return JSON.parse(localStorage.getItem('saved_views') || '[]');
  }

  async deleteView(id: number) {
    const views = JSON.parse(localStorage.getItem('saved_views') || '[]');
    const filtered = views.filter((v: any) => v.id !== id);
    localStorage.setItem('saved_views', JSON.stringify(filtered));
  }
}

export default new ApiService();