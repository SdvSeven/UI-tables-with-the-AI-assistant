import { useState, useCallback, useRef, useEffect } from 'react';
import { debounce } from '@utils';
import { api } from '@services';

export interface QueryFilters {
  [key: string]: any;
}

export interface Aggregation {
  column: string;
  type: string;
  alias: string;
}

export interface Sort {
  column: string | null;
  direction: 'asc' | 'desc';
}

export const useDataQuery = () => {
  const [data, setData] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<QueryFilters>({});
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [aggregations, setAggregations] = useState<Aggregation[]>([]);
  const [sort, setSort] = useState<Sort>({ column: null, direction: 'asc' });

  const cache = useRef(new Map<string, { data: any[]; total: number }>());
  const abortController = useRef<AbortController | null>(null);

  const resetData = useCallback(() => {
    setData([]);
    setTotalRows(0);
    cache.current.clear();
  }, []);

  const fetchChunk = useCallback(async (offset: number, limit: number, append: boolean = true) => {
    const cacheKey = JSON.stringify({ filters, groupBy, aggregations, sort, offset, limit });
    if (cache.current.has(cacheKey)) {
      const cached = cache.current.get(cacheKey)!;
      if (append) {
        setData(prev => {
          const existingIds = new Set(prev.map(item => item.id));
          const newRows = cached.data.filter((row: any) => !existingIds.has(row.id));
          return [...prev, ...newRows];
        });
      } else {
        setData(cached.data);
      }
      setTotalRows(cached.total);
      return;
    }

    if (abortController.current) abortController.current.abort();
    abortController.current = new AbortController();

    setLoading(true);
    try {
      const params = { filters, groupBy, aggregations, sort, offset, limit };
      const result = await api.query(params);
      cache.current.set(cacheKey, { data: result.data, total: result.total });

      if (append) {
        setData(prev => {
          const existingIds = new Set(prev.map(item => item.id));
          const newRows = result.data.filter((row: any) => !existingIds.has(row.id));
          return [...prev, ...newRows];
        });
      } else {
        setData(result.data);
      }
      setTotalRows(result.total);
      setError(null);
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, groupBy, aggregations, sort]);

  // Загружаем ВСЕ строки при инициализации
  useEffect(() => {
    const init = async () => {
      try {
        const total = await api.getTotalRows();
        setTotalRows(total);
        resetData();
        // Загружаем все строки (limit = total)
        await fetchChunk(0, total, false);
      } catch (err) {
        console.error('Initialization error:', err);
        setError('Failed to initialize data');
      }
    };
    init();
    return () => {
      if (abortController.current) abortController.current.abort();
    };
  }, [fetchChunk, resetData]);

  const loadMoreRows = useCallback(async (startIndex: number, stopIndex: number) => {
    // После полной загрузки этот метод вызываться не будет, так как hasMore = false
    const offset = startIndex;
    const limit = stopIndex - startIndex + 1;
    const existingRows = data.length;
    if (existingRows > stopIndex) return;
    await fetchChunk(offset, limit, true);
  }, [fetchChunk, data.length]);

  const applyFilters = useCallback((newFilters: QueryFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    resetData();
    // После фильтрации загружаем первые 100 строк, но можно тоже загрузить все
    fetchChunk(0, 100, false);
  }, [fetchChunk, resetData]);

  const applyGroupBy = useCallback((newGroupBy: string[]) => {
    setGroupBy(newGroupBy);
    resetData();
    fetchChunk(0, 100, false);
  }, [fetchChunk, resetData]);

  const applyAggregations = useCallback((newAggregations: Aggregation[]) => {
    setAggregations(newAggregations);
    resetData();
    fetchChunk(0, 100, false);
  }, [fetchChunk, resetData]);

  const applySort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSort({ column, direction });
    resetData();
    fetchChunk(0, 100, false);
  }, [fetchChunk, resetData]);

  const updateRecord = useCallback(async (id: number, updates: Record<string, any>) => {
    try {
      const updated = await api.updateRecord(id, updates);
      setData(prev => prev.map(row => row.id === id ? updated : row));
      return updated;
    } catch (err) {
      console.error('Update error:', err);
      throw err;
    }
  }, []);

  const hasMore = data.length < totalRows;

  return {
    data,
    totalRows,
    loading,
    error,
    filters,
    groupBy,
    aggregations,
    sort,
    hasMore,
    applyFilters,
    applyGroupBy,
    applyAggregations,
    applySort,
    loadMoreRows,
    updateRecord,
    clearCache: () => cache.current.clear(),
  };
};