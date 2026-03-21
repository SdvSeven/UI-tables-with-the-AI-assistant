import { generateMockSalesChunk } from '@utils';
import { evaluateFormula, extractColumnReferences } from '@utils/formulaEngine';

class MockDataService {
  private data: any[] | null = null;
  private totalRows = 0;
  private ready = false;
  private initPromise: Promise<void> | null = null;
  private formulas: Map<number, Record<string, string>> = new Map();
  private dependencies: Map<string, Set<number>> = new Map();

  constructor() {
    this.initializeAsync();
  }

  initializeAsync() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._generateData();
    return this.initPromise;
  }

  private async _generateData() {
    console.log('Генерация 1 млн строк...');
    const TOTAL = 1_000_000;
    const CHUNK_SIZE = 50_000;
    let generated = 0;
    this.data = [];

    while (generated < TOTAL) {
      const batchSize = Math.min(CHUNK_SIZE, TOTAL - generated);
      const chunk = generateMockSalesChunk(generated + 1, batchSize);
      this.data.push(...chunk);
      generated += batchSize;
      console.log(`Сгенерировано ${generated} из ${TOTAL}`);
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    this.totalRows = this.data.length;
    this.ready = true;
    console.log('Генерация завершена. Всего строк:', this.totalRows);
  }

  private _recomputeCell(rowId: number, column: string) {
    const row = this.data?.find(r => r.id === rowId);
    if (!row) return;
    const formula = this.formulas.get(rowId)?.[column];
    if (formula) {
      const newValue = evaluateFormula(formula, row);
      row[column] = newValue;
    }
  }

  private _recomputeDependents(rowId: number, changedColumn: string) {
    const dependents = this.dependencies.get(changedColumn);
    if (!dependents) return;
    for (const depRowId of dependents) {
      const rowFormulas = this.formulas.get(depRowId);
      if (!rowFormulas) continue;
      for (const [col, formula] of Object.entries(rowFormulas)) {
        if (extractColumnReferences(formula).includes(changedColumn)) {
          this._recomputeCell(depRowId, col);
        }
      }
    }
  }

  private _setFormula(rowId: number, column: string, formula: string) {
    const existing = this.formulas.get(rowId);
    if (existing && existing[column]) {
      delete existing[column];
      if (Object.keys(existing).length === 0) this.formulas.delete(rowId);
    }

    if (formula && formula.startsWith('=')) {
      if (!this.formulas.has(rowId)) this.formulas.set(rowId, {});
      this.formulas.get(rowId)![column] = formula;

      const refs = extractColumnReferences(formula);
      for (const ref of refs) {
        if (!this.dependencies.has(ref)) this.dependencies.set(ref, new Set());
        this.dependencies.get(ref)!.add(rowId);
      }

      const row = this.data!.find(r => r.id === rowId);
      const newValue = evaluateFormula(formula, row);
      row[column] = newValue;
    } else {
      const row = this.data!.find(r => r.id === rowId);
      row[column] = formula;
    }
  }

  async query(params: any) {
    await this.initializeAsync();
    const { filters, groupBy, aggregations, sort, offset = 0, limit = 100 } = params;
    await new Promise(resolve => setTimeout(resolve, 50));

    let result = [...this.data!];

    if (filters) {
      Object.entries(filters).forEach(([field, value]) => {
        if (value !== undefined && value !== '') {
          result = result.filter(row => row[field] === value);
        }
      });
    }

    const totalFiltered = result.length;

    let aggregatedData = result;
    if (groupBy && groupBy.length > 0) {
      const groups = new Map();
      for (const row of result) {
        const key = groupBy.map((f: string) => row[f]).join('|');
        if (!groups.has(key)) groups.set(key, { ...row });
        const group = groups.get(key);
        if (aggregations) {
          aggregations.forEach((agg: any) => {
            const value = row[agg.column];
            if (agg.type === 'sum') {
              group[agg.alias] = (group[agg.alias] || 0) + value;
            } else if (agg.type === 'count') {
              group[agg.alias] = (group[agg.alias] || 0) + 1;
            }
          });
        }
      }
      aggregatedData = Array.from(groups.values());
    }

    // Сортировка
    if (sort && sort.column) {
      const { column, direction } = sort;
      aggregatedData.sort((a, b) => {
        const aVal = a[column];
        const bVal = b[column];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const comparison = String(aVal).localeCompare(String(bVal));
        return direction === 'asc' ? comparison : -comparison;
      });
    }

    const paginated = aggregatedData.slice(offset, offset + limit);

    return {
      data: paginated,
      total: totalFiltered,
      offset,
      limit
    };
  }

  async getTableStructure() {
    await this.initializeAsync();
    return [
      { key: 'id', label: 'ID', type: 'integer', width: 70 },
      { key: 'sale_date', label: 'Дата продажи', type: 'date', width: 100 },
      { key: 'region', label: 'Регион', type: 'string', width: 100 },
      { key: 'product_category', label: 'Категория', type: 'string', width: 120 },
      { key: 'product_name', label: 'Продукт', type: 'string', width: 140 },
      { key: 'quantity', label: 'Количество', type: 'numeric', width: 90 },
      { key: 'price', label: 'Цена', type: 'numeric', width: 90 },
      { key: 'revenue', label: 'Выручка', type: 'numeric', width: 110 },
      { key: 'customer_id', label: 'ID клиента', type: 'integer', width: 90 },
      { key: 'payment_method', label: 'Способ оплаты', type: 'string', width: 120 },
      { key: 'discount', label: 'Скидка %', type: 'numeric', width: 80 },
      { key: 'extra_attributes', label: 'Доп. атрибуты', type: 'json', width: 100 }
    ];
  }

  async updateRecord(id: number, updates: Record<string, any>) {
    await this.initializeAsync();
    await new Promise(resolve => setTimeout(resolve, 50));

    const rowIndex = this.data!.findIndex(row => row.id === id);
    if (rowIndex === -1) throw new Error(`Record ${id} not found`);
    const oldRow = this.data![rowIndex];

    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'string' && value.trim().startsWith('=')) {
        this._setFormula(id, key, value);
      } else {
        const rowFormulas = this.formulas.get(id);
        if (rowFormulas && rowFormulas[key]) {
          delete rowFormulas[key];
          if (Object.keys(rowFormulas).length === 0) this.formulas.delete(id);
        }
        oldRow[key] = value;
      }
    }

    const changedColumns = Object.keys(updates);
    for (const col of changedColumns) {
      this._recomputeDependents(id, col);
    }

    return { ...oldRow };
  }

  async getCellFormula(id: number, column: string): Promise<string | null> {
    await this.initializeAsync();
    const rowFormulas = this.formulas.get(id);
    return rowFormulas?.[column] || null;
  }

  async getTotalRows(): Promise<number> {
    await this.initializeAsync();
    return this.totalRows;
  }

  async sendAIQuery(query: string, context: any): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return `(Заглушка) Ваш запрос: "${query}".\nКонтекст: фильтры = ${JSON.stringify(context.filters)}, группировка = ${JSON.stringify(context.groupBy)}.`;
  }
}

export default new MockDataService();