import { useState, useEffect } from 'react';
import { api } from '@services';

export const useViewState = () => {
  const [views, setViews] = useState<any[]>([]);
  const [currentView, setCurrentView] = useState<any>(null);

  useEffect(() => {
    loadViews();
  }, []);

  const loadViews = async () => {
    const saved = await api.getViews();
    setViews(saved);
  };

  const saveView = async (name: string, state: any) => {
    const newView = {
      id: Date.now(),
      name,
      state,
      createdAt: new Date().toISOString()
    };
    await api.saveView(newView);
    await loadViews();
    return newView;
  };

  const loadView = async (id: number) => {
    const view = views.find(v => v.id === id);
    if (view) {
      setCurrentView(view);
      return view.state;
    }
    return null;
  };

  const deleteView = async (id: number) => {
    await api.deleteView(id);
    await loadViews();
  };

  return { views, currentView, saveView, loadView, deleteView };
};