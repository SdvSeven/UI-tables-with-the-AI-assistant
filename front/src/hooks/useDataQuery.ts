import { useState, useCallback, useEffect, useRef } from 'react';
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
          groupBy,
          aggregations,
          sort: sort.column ? { column: sort.column, direction: sort.direction } : undefined,
        },
        abortController.current.signal,
      );

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
  }, [filters, groupBy, aggregations, sort]);

  useEffect(() => {
    fetchChunk(0, false);
    return () => abortController.current?.abort();
  }, []);

  useEffect(() => {
    setData([]);
    fetchChunk(0, false);
  }, [filters, groupBy, aggregations, sort]);

  const loadMoreRows = useCallback(async (_startIndex: number, _stopIndex: number) => {
    if (data.length >= totalRows) return;
    const nextOffset = data.length;
    await fetchChunk(nextOffset, true);
  }, [data.length, totalRows, fetchChunk]);

  const applyFilters = useCallback((newFilters: QueryFilters) => setFilters(newFilters), []);
  const applyGroupBy = useCallback((newGroupBy: string[]) => setGroupBy(newGroupBy), []);
  const applyAggregations = useCallback((newAggregations: Aggregation[]) => setAggregations(newAggregations), []);
  const applySort = useCallback((column: string, direction: 'asc' | 'desc') => setSort({ column, direction }), []);

  const updateRecord = useCallback(async (id: number, updates: Record<string, any>) => {
    const oldRow = data.find(r => r.id === id);
    if (!oldRow) throw new Error('Запись не найдена');
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
    if (!oldRow) throw new Error('Запись не найдена');
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
    createRecord,
    deleteRecord,
  };
};