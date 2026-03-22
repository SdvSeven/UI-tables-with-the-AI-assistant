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

  const PAGE_SIZE = 10000;
  const abortController = useRef<AbortController | null>(null);

  const fetchChunk = useCallback(async (offset: number, append: boolean = true) => {
    if (abortController.current) abortController.current.abort();
    abortController.current = new AbortController();

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

      console.log('Data received:', result.data.length, 'rows, total:', result.total);

      if (append) {
        setData(prev => {
          const existingIds = new Set(prev.map((r: any) => r.id));
          const newRows = result.data.filter((r: any) => !existingIds.has(r.id));
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
  }, [filters, sort]);

  useEffect(() => {
    fetchChunk(0, false);
    return () => abortController.current?.abort();
  }, []);

  useEffect(() => {
    console.log('Filters or sort changed, reloading data');
    setData([]);
    fetchChunk(0, false);
  }, [filters, sort]);

  const loadMoreRows = useCallback(async (_startIndex: number, _stopIndex: number) => {
    if (data.length >= totalRows) return;
    const nextOffset = data.length;
    await fetchChunk(nextOffset, true);
  }, [data.length, totalRows, fetchChunk]);

  const applyFilters = useCallback((newFilters: QueryFilters) => {
    console.log('applyFilters called with:', newFilters);
    setFilters(newFilters);
  }, []);

  const applySort = useCallback((column: string, direction: 'asc' | 'desc') => {
    console.log('applySort called with:', column, direction);
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
    loadMoreRows,
    updateRecord,
    createRecord,
    deleteRecord,
  };
};