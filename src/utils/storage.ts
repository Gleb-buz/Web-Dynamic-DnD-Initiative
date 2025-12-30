import { AppState } from '../types';

const STORAGE_KEY = 'dnd-dynamic-initiative-state';

export const loadState = (): AppState | null => {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppState;
  } catch (err) {
    console.error('Failed to parse saved state', err);
    return null;
  }
};

export const saveState = (state: AppState) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const clearState = () => {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
};
