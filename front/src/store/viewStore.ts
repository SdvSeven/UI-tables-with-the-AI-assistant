import { create } from 'zustand';

interface ViewState {
  views: any[];
  currentView: any | null;
  setViews: (views: any[]) => void;
  setCurrentView: (view: any | null) => void;
}

export const useViewStore = create<ViewState>((set) => ({
  views: [],
  currentView: null,
  setViews: (views) => set({ views }),
  setCurrentView: (view) => set({ currentView: view }),
}));