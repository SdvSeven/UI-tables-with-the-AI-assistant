const API_BASE = 'http://172.24.148.116:8080/api';

class ApiService {
  private transformFilters(filters: Record<string, any>): Record<string, string> {
    const result: Record<string, string> = {};

    for (let [key, value] of Object.entries(filters)) {
      if (value === undefined || value === '') continue;

      switch (key) {
        case 'sale_date':
          result['startDate'] = String(value);
          result['endDate'] = String(value);
          break;
        case 'revenue':
          if (typeof value === 'string' && value.includes('-')) {
            const [min, max] = value.split('-');
            if (min) result['minRevenue'] = min.trim();
            if (max) result['maxRevenue'] = max.trim();
          } else {
            result['minRevenue'] = String(value);
          }
          break;
        case 'product_category':
          result['productCategory'] = String(value);
          break;
        case 'product_name':
          result['productName'] = String(value);
          break;
        case 'payment_method':
          result['paymentMethod'] = String(value);
          break;
        case 'customer_id':
          result['customerId'] = String(value);
          break;
        default:
          result[key] = String(value);
      }
    }
    return result;
  }

  async getTotalRows(filters: Record<string, any> = {}): Promise<number> {
    const transformed = this.transformFilters(filters);
    const params = new URLSearchParams(transformed);
    const url = `${API_BASE}/sales/count?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Ошибка получения count: ${response.status}`);
    const data = await response.json();
    return data.count;
  }

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

    const transformed = this.transformFilters(filters);
    const urlParams = new URLSearchParams(transformed);
    urlParams.append('offset', String(offset));
    urlParams.append('limit', String(limit));

    if (sort?.column) {
      urlParams.append('sort', sort.column);
      urlParams.append('order', sort.direction);
    }

    const url = `${API_BASE}/sales?${urlParams.toString()}`;
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Ошибка запроса: ${response.status}`);
    const rows = await response.json();

    const total = await this.getTotalRows(filters);
    return { data: rows, total, offset, limit };
  }

  async getTableStructure() {
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

  async getRecordById(id: number): Promise<Record<string, any>> {
    const response = await fetch(`${API_BASE}/sales/${id}`);
    if (!response.ok) throw new Error(`Запись ${id} не найдена`);
    return await response.json();
  }

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

  async createRecord(record: Record<string, any>) {
    const response = await fetch(`${API_BASE}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (!response.ok) throw new Error(`Ошибка создания: ${response.status}`);
    return await response.json();
  }

  async deleteRecord(id: number) {
    const response = await fetch(`${API_BASE}/sales/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`Ошибка удаления: ${response.status}`);
    return true;
  }

  async getCellFormula(_id: number, _column: string): Promise<string | null> {
    return null;
  }

  async sendAIQuery(query: string, _context: any): Promise<string> {
    // Forward natural language query to backend orchestrator
    try {
      const res = await fetch('http://localhost:8080/api/v1/orchestrator/nl-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'sales', question: query, explain: false }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Backend error: ${res.status} ${text}`);
      }
      const j = await res.json();
      return JSON.stringify(j);
    } catch (e: any) {
      throw e;
    }
  }

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