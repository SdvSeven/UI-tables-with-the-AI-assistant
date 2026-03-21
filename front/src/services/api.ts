import MockDataService from './mockDataService';

const USE_MOCK = true;

class ApiService {
  private mockService = MockDataService;
  private baseUrl = 'http://localhost:8080/api';

  async query(params: any) {
    if (USE_MOCK) return this.mockService.query(params);
    const response = await fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return response.json();
  }

  async getTableStructure(): Promise<any[]> {
    if (USE_MOCK) return this.mockService.getTableStructure();
    const response = await fetch(`${this.baseUrl}/structure`);
    return response.json();
  }

  async updateRecord(id: number, updates: Record<string, any>) {
    if (USE_MOCK) return this.mockService.updateRecord(id, updates);
    const response = await fetch(`${this.baseUrl}/records/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return response.json();
  }

  async getCellFormula(id: number, column: string): Promise<string | null> {
    if (USE_MOCK) return this.mockService.getCellFormula(id, column);
    const response = await fetch(`${this.baseUrl}/formula/${id}/${column}`);
    return response.json();
  }

  async saveView(view: any) {
    if (USE_MOCK) {
      const views = JSON.parse(localStorage.getItem('saved_views') || '[]');
      views.push(view);
      localStorage.setItem('saved_views', JSON.stringify(views));
      return view;
    }
    const response = await fetch(`${this.baseUrl}/views`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(view)
    });
    return response.json();
  }

  async getViews() {
    if (USE_MOCK) return JSON.parse(localStorage.getItem('saved_views') || '[]');
    const response = await fetch(`${this.baseUrl}/views`);
    return response.json();
  }

  async deleteView(id: number) {
    if (USE_MOCK) {
      const views = JSON.parse(localStorage.getItem('saved_views') || '[]');
      const filtered = views.filter((v: any) => v.id !== id);
      localStorage.setItem('saved_views', JSON.stringify(filtered));
    } else {
      await fetch(`${this.baseUrl}/views/${id}`, { method: 'DELETE' });
    }
  }

  async getTotalRows(): Promise<number> {
    if (USE_MOCK) return this.mockService.getTotalRows();
    const response = await fetch(`${this.baseUrl}/total`);
    return response.json();
  }
}

export default new ApiService();