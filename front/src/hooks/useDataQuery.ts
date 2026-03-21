import { useState, useCallback, useRef, useEffect } from 'react';
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
  const [pageSize] = useState(100);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Отмена последнего запроса
  const cancelLastRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Функция загрузки порции данных
  const fetchChunk = useCallback(async (offset: number, append: boolean = true) => {
    // Отменяем предыдущий запрос, если он ещё не завершён
    cancelLastRequest();

    // Создаём новый AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    try {
      const result = await api.query({
        offset,
        limit: pageSize,
        filters,
        sort: sort.column ? { column: sort.column, direction: sort.direction } : undefined,
      }, controller.signal); // передаём сигнал в api.query

      if (!isMountedRef.current) return; // компонент размонтирован

      if (append) {
        setData(prev => {
          const existingIds = new Set(prev.map(item => item.id));
          const newRows = result.data.filter(row => !existingIds.has(row.id));
          return [...prev, ...newRows];
        });
      } else {
        setData(result.data);
      }
      setTotalRows(result.total);
      setError(null);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }
      if (isMountedRef.current) {
        setError(err.message);
        console.error('Fetch error:', err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
      // Если это был последний запрос, очищаем контроллер
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [filters, sort, pageSize, cancelLastRequest]);

  // Инициализация
  useEffect(() => {
    isMountedRef.current = true;
    fetchChunk(0, false);
    return () => {
      isMountedRef.current = false;
      cancelLastRequest(); // отменяем запрос при размонтировании
    };
  }, []);

  // При изменении фильтров или сортировки сбрасываем данные и загружаем первую страницу
  useEffect(() => {
    // Не вызываем fetchChunk, если это первая загрузка (этот эффект сработает при изменении)
    // Добавим проверку на то, что инициализация уже прошла
    setData([]);
    fetchChunk(0, false);
  }, [filters, sort]);

  // Подгрузка следующих страниц (вызывается InfiniteLoader)
  const loadMoreRows = useCallback(async (startIndex: number, stopIndex: number) => {
    if (data.length >= totalRows) return;
    const nextOffset = data.length;
    await fetchChunk(nextOffset, true);
  }, [data.length, totalRows, fetchChunk]);

  const applyFilters = useCallback((newFilters: QueryFilters) => {
    setFilters(newFilters);
  }, []);

  const applySort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSort({ column, direction });
  }, []);

  const updateRecord = useCallback(async (id: number, updates: Record<string, any>) => {
    const oldRecord = data.find(r => r.id === id);
    if (!oldRecord) throw new Error('Record not found');

    setData(prev => prev.map(row => row.id === id ? { ...row, ...updates } : row));

    try {
      const updated = await api.updateRecord(id, updates);
      setData(prev => prev.map(row => row.id === id ? updated : row));
      return updated;
    } catch (err) {
      setData(prev => prev.map(row => row.id === id ? oldRecord : row));
      throw err;
    }
  }, [data]);

  const createRecord = useCallback(async (record: Record<string, any>) => {
    const newRecord = await api.createRecord(record);
    setData(prev => [...prev, newRecord]);
    setTotalRows(prev => prev + 1);
    return newRecord;
  }, []);

  const deleteRecord = useCallback(async (id: number) => {
    const oldRecord = data.find(r => r.id === id);
    if (!oldRecord) throw new Error('Record not found');

    setData(prev => prev.filter(row => row.id !== id));
    setTotalRows(prev => prev - 1);

    try {
      await api.deleteRecord(id);
    } catch (err) {
      setData(prev => [...prev, oldRecord].sort((a, b) => a.id - b.id));
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