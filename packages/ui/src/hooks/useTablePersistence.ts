import { useEffect, useRef, useCallback } from 'react';
import type { TableState, ViewSort, RangeFilter } from './useTableState';

export interface TablePersistenceConfig {
  tableName: string;
  getState: () => TableState;
  setState: (state: Partial<TableState>) => void;
  load: (tableName: string) => Promise<SerializedTableState | null>;
  save: (tableName: string, state: SerializedTableState) => Promise<void>;
  debounceMs?: number;
}

export interface SerializedTableState {
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: ViewSort;
  filters?: Record<string, string[]>;
  rangeFilters?: Record<string, RangeFilter>;
}

export function useTablePersistence(config: TablePersistenceConfig): {
  isLoaded: boolean;
} {
  const { tableName, getState, setState, load, save, debounceMs = 300 } = config;

  const isLoadedRef = useRef(false);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;

    load(tableName).then((savedState) => {
      if (!mounted || !savedState) {
        isLoadedRef.current = true;
        return;
      }

      const restored: Partial<TableState> = {};

      if (savedState.search !== undefined) {
        restored.search = savedState.search;
      }
      if (savedState.page !== undefined) {
        restored.page = savedState.page;
      }
      if (savedState.pageSize !== undefined) {
        restored.pageSize = savedState.pageSize;
      }
      if (savedState.sort !== undefined) {
        restored.sort = savedState.sort;
      }
      if (savedState.filters !== undefined) {
        const filters: Record<string, Set<string>> = {};
        for (const [key, values] of Object.entries(savedState.filters)) {
          filters[key] = new Set(values);
        }
        restored.filters = filters;
      }
      if (savedState.rangeFilters !== undefined) {
        restored.rangeFilters = savedState.rangeFilters;
      }

      setState(restored);
      isLoadedRef.current = true;
    });

    return () => {
      mounted = false;
    };
  }, [tableName, load, setState]);

  const persistState = useCallback(() => {
    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }

    persistTimeoutRef.current = setTimeout(() => {
      const state = getState();

      const filtersObj: Record<string, string[]> = {};
      for (const [key, values] of Object.entries(state.filters)) {
        filtersObj[key] = Array.from(values);
      }

      const serialized: SerializedTableState = {
        search: state.search,
        page: state.page,
        pageSize: state.pageSize,
        sort: state.sort,
        filters: filtersObj,
        rangeFilters: state.rangeFilters,
      };

      save(tableName, serialized);
    }, debounceMs);
  }, [tableName, getState, save, debounceMs]);

  useEffect(() => {
    if (isLoadedRef.current) {
      persistState();
    }
  }, [persistState]);

  useEffect(() => {
    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
    };
  }, []);

  return {
    isLoaded: isLoadedRef.current,
  };
}
