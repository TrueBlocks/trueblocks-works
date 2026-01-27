import { useState, useMemo, useCallback } from 'react';
import { useDebouncedValue } from '@mantine/hooks';

export type SortDirection = 'asc' | 'desc' | '';

export interface SortColumn {
  column: string;
  direction: SortDirection;
}

export interface ViewSort {
  primary: SortColumn;
  secondary: SortColumn;
  tertiary: SortColumn;
  quaternary: SortColumn;
}

export interface RangeFilter {
  min?: number;
  max?: number;
}

export interface ColumnConfig<T> {
  key: string;
  filterOptions?: readonly string[];
  filterRange?: boolean;
  sortValue?: (item: T) => string | number;
}

export interface TableStateConfig<T> {
  data: T[];
  columns: ColumnConfig<T>[];
  searchFn?: (item: T, query: string) => boolean;
  valueGetter?: (item: T, column: string) => unknown;
  initialPageSize?: number;
}

export interface TableState {
  search: string;
  page: number;
  pageSize: number;
  sort: ViewSort;
  filters: Record<string, Set<string>>;
  rangeFilters: Record<string, RangeFilter>;
  selectedIndex: number;
}

export interface TableStateReturn<T> {
  search: string;
  setSearch: (value: string) => void;
  page: number;
  setPage: (value: number) => void;
  pageSize: number;
  setPageSize: (value: number) => void;
  selectedIndex: number;
  setSelectedIndex: (value: number) => void;
  sort: ViewSort;
  filters: Record<string, Set<string>>;
  rangeFilters: Record<string, RangeFilter>;
  handleColumnClick: (column: string, metaKey: boolean) => void;
  handleFilterToggle: (columnKey: string, value: string) => void;
  handleFilterSelectAll: (columnKey: string) => void;
  handleFilterSelectNone: (columnKey: string) => void;
  handleFilterSelectOnly: (columnKey: string, value: string) => void;
  handleRangeFilterChange: (columnKey: string, min?: number, max?: number) => void;
  handleClearAll: () => void;
  getSortInfo: (column: string) => { level: 1 | 2 | 3 | 4 | null; direction: SortDirection };
  hasActiveFilters: boolean;
  hasActiveSort: boolean;
  filteredData: T[];
  sortedData: T[];
  paginatedData: T[];
  totalPages: number;
  effectivePage: number;
  globalIndex: number;
  navigateToGlobalIndex: (index: number) => void;
  getState: () => TableState;
  setState: (state: Partial<TableState>) => void;
}

const emptySortColumn: SortColumn = { column: '', direction: '' };
const emptyViewSort: ViewSort = {
  primary: emptySortColumn,
  secondary: emptySortColumn,
  tertiary: emptySortColumn,
  quaternary: emptySortColumn,
};

export function useTableState<T>(config: TableStateConfig<T>): TableStateReturn<T> {
  const { data, columns, searchFn, valueGetter, initialPageSize = 20 } = config;

  const [search, setSearchRaw] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 200);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sort, setSort] = useState<ViewSort>(emptyViewSort);
  const [filters, setFilters] = useState<Record<string, Set<string>>>({});
  const [rangeFilters, setRangeFilters] = useState<Record<string, RangeFilter>>({});

  const setSearch = useCallback((value: string) => {
    setSearchRaw(value);
    setPage(1);
    setSelectedIndex(0);
  }, []);

  const getValue = useCallback(
    (item: T, column: string): unknown => {
      if (valueGetter) {
        return valueGetter(item, column);
      }
      return (item as Record<string, unknown>)[column];
    },
    [valueGetter]
  );

  const hasActiveFilters = useMemo(() => {
    for (const col of columns) {
      if (col.filterOptions) {
        const currentFilter = filters[col.key];
        if (currentFilter && currentFilter.size < col.filterOptions.length) {
          return true;
        }
      }
    }
    for (const key of Object.keys(rangeFilters)) {
      const range = rangeFilters[key];
      if (range && (range.min !== undefined || range.max !== undefined)) {
        return true;
      }
    }
    return false;
  }, [columns, filters, rangeFilters]);

  const hasActiveSort = useMemo(() => sort.primary.column !== '', [sort.primary.column]);

  const handleClearAll = useCallback(() => {
    setSearchRaw('');
    const resetFilters: Record<string, Set<string>> = {};
    columns.forEach((col) => {
      if (col.filterOptions) {
        resetFilters[col.key] = new Set(col.filterOptions);
      }
    });
    setFilters(resetFilters);
    setRangeFilters({});
    setSort(emptyViewSort);
  }, [columns]);

  const handleColumnClick = useCallback((column: string, metaKey: boolean) => {
    setSort((prev) => {
      if (metaKey) {
        if (prev.primary.column === column) {
          return emptyViewSort;
        }
        return {
          primary: { column, direction: 'asc' },
          secondary: emptySortColumn,
          tertiary: emptySortColumn,
          quaternary: emptySortColumn,
        };
      }

      if (prev.primary.column === column) {
        if (prev.primary.direction === 'asc') {
          return { ...prev, primary: { column, direction: 'desc' } };
        } else if (prev.primary.direction === 'desc') {
          return {
            primary: prev.secondary,
            secondary: prev.tertiary,
            tertiary: prev.quaternary,
            quaternary: emptySortColumn,
          };
        }
        return { ...prev, primary: { column, direction: 'asc' } };
      } else if (prev.secondary.column === column) {
        if (prev.secondary.direction === 'asc') {
          return { ...prev, secondary: { column, direction: 'desc' } };
        } else if (prev.secondary.direction === 'desc') {
          return {
            ...prev,
            secondary: prev.tertiary,
            tertiary: prev.quaternary,
            quaternary: emptySortColumn,
          };
        }
        return { ...prev, secondary: { column, direction: 'asc' } };
      } else if (prev.tertiary.column === column) {
        if (prev.tertiary.direction === 'asc') {
          return { ...prev, tertiary: { column, direction: 'desc' } };
        } else if (prev.tertiary.direction === 'desc') {
          return {
            ...prev,
            tertiary: prev.quaternary,
            quaternary: emptySortColumn,
          };
        }
        return { ...prev, tertiary: { column, direction: 'asc' } };
      } else if (prev.quaternary.column === column) {
        if (prev.quaternary.direction === 'asc') {
          return { ...prev, quaternary: { column, direction: 'desc' } };
        } else if (prev.quaternary.direction === 'desc') {
          return { ...prev, quaternary: emptySortColumn };
        }
        return { ...prev, quaternary: { column, direction: 'asc' } };
      } else {
        const newSort = { column, direction: 'asc' as SortDirection };
        if (!prev.primary.column) {
          return { ...prev, primary: newSort };
        } else if (!prev.secondary.column) {
          return { ...prev, secondary: newSort };
        } else if (!prev.tertiary.column) {
          return { ...prev, tertiary: newSort };
        } else if (!prev.quaternary.column) {
          return { ...prev, quaternary: newSort };
        }
        return prev;
      }
    });
  }, []);

  const getSortInfo = useCallback(
    (column: string): { level: 1 | 2 | 3 | 4 | null; direction: SortDirection } => {
      if (sort.primary.column === column) {
        return { level: 1, direction: sort.primary.direction };
      }
      if (sort.secondary.column === column) {
        return { level: 2, direction: sort.secondary.direction };
      }
      if (sort.tertiary.column === column) {
        return { level: 3, direction: sort.tertiary.direction };
      }
      if (sort.quaternary.column === column) {
        return { level: 4, direction: sort.quaternary.direction };
      }
      return { level: null, direction: '' };
    },
    [sort]
  );

  const handleFilterToggle = useCallback((columnKey: string, value: string) => {
    setFilters((prev) => {
      const current = prev[columnKey] ?? new Set<string>();
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return { ...prev, [columnKey]: next };
    });
  }, []);

  const handleFilterSelectAll = useCallback(
    (columnKey: string) => {
      const col = columns.find((c) => c.key === columnKey);
      if (col?.filterOptions) {
        setFilters((prev) => ({ ...prev, [columnKey]: new Set(col.filterOptions) }));
      }
    },
    [columns]
  );

  const handleFilterSelectNone = useCallback((columnKey: string) => {
    setFilters((prev) => ({ ...prev, [columnKey]: new Set<string>() }));
  }, []);

  const handleFilterSelectOnly = useCallback((columnKey: string, value: string) => {
    setFilters((prev) => ({ ...prev, [columnKey]: new Set([value]) }));
  }, []);

  const handleRangeFilterChange = useCallback((columnKey: string, min?: number, max?: number) => {
    const rangeFilter: RangeFilter = {};
    if (min !== undefined) rangeFilter.min = min;
    if (max !== undefined) rangeFilter.max = max;
    setRangeFilters((prev) => ({ ...prev, [columnKey]: rangeFilter }));
  }, []);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (searchFn && debouncedSearch && !searchFn(item, debouncedSearch)) {
        return false;
      }

      for (const col of columns) {
        if (col.filterOptions) {
          const selected = filters[col.key];
          if (selected && selected.size > 0 && selected.size < col.filterOptions.length) {
            const value = String(getValue(item, col.key) ?? '');
            if (!selected.has(value)) {
              return false;
            }
          }
        }
        if (col.filterRange) {
          const rf = rangeFilters[col.key];
          if (rf) {
            const value = getValue(item, col.key);
            const numValue = typeof value === 'number' ? value : undefined;
            if (rf.min !== undefined && (numValue === undefined || numValue < rf.min)) {
              return false;
            }
            if (rf.max !== undefined && (numValue === undefined || numValue > rf.max)) {
              return false;
            }
          }
        }
      }
      return true;
    });
  }, [data, debouncedSearch, searchFn, columns, filters, rangeFilters, getValue]);

  const sortedData = useMemo(() => {
    if (!sort.primary.column) return filteredData;

    const getSortValue = (item: T, columnKey: string): unknown => {
      const col = columns.find((c) => c.key === columnKey);
      if (col?.sortValue) {
        return col.sortValue(item);
      }
      return getValue(item, columnKey);
    };

    return [...filteredData].sort((a, b) => {
      const compareValues = (valA: unknown, valB: unknown, direction: SortDirection): number => {
        if (valA == null && valB == null) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;

        let result: number;
        if (typeof valA === 'string' && typeof valB === 'string') {
          result = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
        } else if (typeof valA === 'number' && typeof valB === 'number') {
          result = valA - valB;
        } else {
          result = String(valA).localeCompare(String(valB));
        }

        return direction === 'desc' ? -result : result;
      };

      const primaryResult = compareValues(
        getSortValue(a, sort.primary.column),
        getSortValue(b, sort.primary.column),
        sort.primary.direction
      );

      if (primaryResult !== 0 || !sort.secondary.column) {
        return primaryResult;
      }

      const secondaryResult = compareValues(
        getSortValue(a, sort.secondary.column),
        getSortValue(b, sort.secondary.column),
        sort.secondary.direction
      );

      if (secondaryResult !== 0 || !sort.tertiary.column) {
        return secondaryResult;
      }

      const tertiaryResult = compareValues(
        getSortValue(a, sort.tertiary.column),
        getSortValue(b, sort.tertiary.column),
        sort.tertiary.direction
      );

      if (tertiaryResult !== 0 || !sort.quaternary.column) {
        return tertiaryResult;
      }

      return compareValues(
        getSortValue(a, sort.quaternary.column),
        getSortValue(b, sort.quaternary.column),
        sort.quaternary.direction
      );
    });
  }, [filteredData, sort, getValue, columns]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const effectivePage = useMemo(() => {
    if (page > totalPages && totalPages > 0) {
      return totalPages;
    }
    return page;
  }, [page, totalPages]);

  const paginatedData = useMemo(() => {
    const start = (effectivePage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, effectivePage, pageSize]);

  const globalIndex = useMemo(() => {
    return (effectivePage - 1) * pageSize + selectedIndex;
  }, [effectivePage, pageSize, selectedIndex]);

  const navigateToGlobalIndex = useCallback(
    (newGlobalIndex: number) => {
      if (sortedData.length === 0) return;
      const clampedIndex = Math.max(0, Math.min(newGlobalIndex, sortedData.length - 1));
      const newPage = Math.floor(clampedIndex / pageSize) + 1;
      const newLocalIndex = clampedIndex % pageSize;
      setPage(newPage);
      setSelectedIndex(newLocalIndex);
    },
    [sortedData.length, pageSize]
  );

  const getState = useCallback((): TableState => {
    return {
      search,
      page,
      pageSize,
      sort,
      filters,
      rangeFilters,
      selectedIndex,
    };
  }, [search, page, pageSize, sort, filters, rangeFilters, selectedIndex]);

  const setState = useCallback((state: Partial<TableState>) => {
    if (state.search !== undefined) setSearchRaw(state.search);
    if (state.page !== undefined) setPage(state.page);
    if (state.pageSize !== undefined) setPageSize(state.pageSize);
    if (state.sort !== undefined) setSort(state.sort);
    if (state.filters !== undefined) setFilters(state.filters);
    if (state.rangeFilters !== undefined) setRangeFilters(state.rangeFilters);
    if (state.selectedIndex !== undefined) setSelectedIndex(state.selectedIndex);
  }, []);

  return {
    search,
    setSearch,
    page,
    setPage,
    pageSize,
    setPageSize,
    selectedIndex,
    setSelectedIndex,
    sort,
    filters,
    rangeFilters,
    handleColumnClick,
    handleFilterToggle,
    handleFilterSelectAll,
    handleFilterSelectNone,
    handleFilterSelectOnly,
    handleRangeFilterChange,
    handleClearAll,
    getSortInfo,
    hasActiveFilters,
    hasActiveSort,
    filteredData,
    sortedData,
    paginatedData,
    totalPages,
    effectivePage,
    globalIndex,
    navigateToGlobalIndex,
    getState,
    setState,
  };
}
