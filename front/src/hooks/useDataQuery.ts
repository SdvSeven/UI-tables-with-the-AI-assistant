import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '@services';

export interface QueryFilters {
  [key: string]: any;
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
  const [sort, setSort] = useState<Sort>({ column: null, direction: 'asc' });

  const PAGE_SIZE = 100;
  const cache = useRef<Map<string, any[]>>(new Map());
  const abortController = useRef<AbortController | null>(null);
  const isFetching = useRef(false);

  const reset = useCallback(() => {
    setData([]);
    setTotalRows(0);
    cache.current.clear();
  }, []);

  const fetchPage = useCallback(async (page: number, append: boolean = true) => {
    const offset = page * PAGE_SIZE;
    const cacheKey = JSON.stringify({ filters, sort, offset, limit: PAGE_SIZE });

    if (cache.current.has(cacheKey)) {
      const cachedRows = cache.current.get(cacheKey)!;
      if (append) {
        setData(prev => [...prev, ...cachedRows]);
      } else {
        setData(cachedRows);
      }
      return;
    }

    if (isFetching.current) return;
    if (abortController.current) abortController.current.abort();
    abortController.current = new AbortController();

    isFetching.current = true;
    setLoading(true);
    try {
      const result = await api.query(
        {
          offset,
          limit: PAGE_SIZE,
          filters,
          sort: sort.column ? { column: sort.column, direction: sort.direction } : undefined,
        },
        abortController.current.signal,
      );

      cache.current.set(cacheKey, result.data);

      if (append) {
        setData(prev => [...prev, ...result.data]);
      } else {
        setData(result.data);
      }
      setTotalRows(result.total);
      setError(null);
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [filters, sort]);

  useEffect(() => {
    reset();
    const loadFirstPage = async () => {
      const total = await api.getTotalRows(filters);
      setTotalRows(total);
      await fetchPage(0, false);
    };
    loadFirstPage();
    return () => abortController.current?.abort();
  }, [filters, sort]);

  const loadMore = useCallback(async () => {
    if (loading || isFetching.current) return;
    const currentLength = data.length;
    if (currentLength >= totalRows) return;
    const nextPage = Math.floor(currentLength / PAGE_SIZE);
    await fetchPage(nextPage, true);
  }, [data.length, totalRows, loading, fetchPage, PAGE_SIZE]);

  const applyFilters = useCallback((newFilters: QueryFilters) => {
    setFilters(newFilters);
  }, []);

  const applySort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSort({ column, direction });
  }, []);

  const updateRecord = useCallback(async (id: number, updates: Record<string, any>) => {
    const oldRow = data.find(r => r.id === id);
    if (!oldRow) throw new Error('Record not found');
    setData(prev => prev.map(row => (row.id === id ? { ...row, ...updates } : row)));
    try {
      const updated = await api.updateRecord(id, updates);
      setData(prev => prev.map(row => (row.id === id ? updated : row)));
      return updated;
    } catch (err) {
      setData(prev => prev.map(row => (row.id === id ? oldRow : row)));
      throw err;
    }
  }, [data]);

  const createRecord = useCallback(async (record: any) => {
    const newRecord = await api.createRecord(record);
    setData(prev => [...prev, newRecord]);
    setTotalRows(prev => prev + 1);
    return newRecord;
  }, []);

  const deleteRecord = useCallback(async (id: number) => {
    const oldRow = data.find(r => r.id === id);
    if (!oldRow) throw new Error('Record not found');
    setData(prev => prev.filter(row => row.id !== id));
    setTotalRows(prev => prev - 1);
    try {
      await api.deleteRecord(id);
    } catch (err) {
      setData(prev => [...prev, oldRow].sort((a, b) => a.id - b.id));
      setTotalRows(prev => prev + 1);
      throw err;
    }
  }, [data]);

  const hasMore = data.length < totalRows;

  return {
    data,
    totalRows,
    loading,
    error,
    filters,
    sort,
    hasMore,
    applyFilters,
    applySort,
    loadMore,
    updateRecord,
    createRecord,
    deleteRecord,
  };
};