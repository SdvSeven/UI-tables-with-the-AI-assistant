import { create } from 'zustand';

interface DataState {
  data: any[];
  totalRows: number;
  loading: boolean;
  error: string | null;
  setData: (data: any[]) => void;
  setTotalRows: (total: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useDataStore = create<DataState>((set) => ({
  data: [],
  totalRows: 0,
  loading: false,
  error: null,
  setData: (data) => set({ data }),
  setTotalRows: (total) => set({ totalRows: total }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));