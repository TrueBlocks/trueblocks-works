import { useState, useCallback, useMemo } from 'react';
import { SetViewSort } from '@wailsjs/go/main/App';
import { state } from '@wailsjs/go/models';

export type SortDirection = 'asc' | 'desc' | '';

export interface SortColumn {
  column: string;
  direction: SortDirection;
}

export interface ViewSort {
  primary: SortColumn;
  secondary: SortColumn;
}

const emptySortColumn: SortColumn = { column: '', direction: '' };
const emptyViewSort: ViewSort = { primary: emptySortColumn, secondary: emptySortColumn };

export function useTableSort<T>(
  viewName: string,
  initialSort?: ViewSort,
  valueGetter?: (item: T, column: string) => unknown
) {
  const [sort, setSort] = useState<ViewSort>(initialSort || emptyViewSort);

  const handleColumnClick = useCallback(
    (column: string) => {
      setSort((prev) => {
        let newSort: ViewSort;

        if (prev.primary.column === column) {
          if (prev.primary.direction === 'asc') {
            newSort = { ...prev, primary: { column, direction: 'desc' } };
          } else if (prev.primary.direction === 'desc') {
            newSort = { primary: prev.secondary, secondary: emptySortColumn };
          } else {
            newSort = { ...prev, primary: { column, direction: 'asc' } };
          }
        } else if (prev.secondary.column === column) {
          if (prev.secondary.direction === 'asc') {
            newSort = { ...prev, secondary: { column, direction: 'desc' } };
          } else if (prev.secondary.direction === 'desc') {
            newSort = { ...prev, secondary: emptySortColumn };
          } else {
            newSort = { ...prev, secondary: { column, direction: 'asc' } };
          }
        } else {
          newSort = {
            primary: { column, direction: 'asc' },
            secondary: prev.primary.column ? prev.primary : emptySortColumn,
          };
        }

        const backendSort = new state.ViewSort({
          primary: new state.SortColumn(newSort.primary),
          secondary: new state.SortColumn(newSort.secondary),
        });
        SetViewSort(viewName, backendSort);

        return newSort;
      });
    },
    [viewName]
  );

  const getSortInfo = useCallback(
    (column: string): { level: 1 | 2 | null; direction: SortDirection } => {
      if (sort.primary.column === column) {
        return { level: 1, direction: sort.primary.direction };
      }
      if (sort.secondary.column === column) {
        return { level: 2, direction: sort.secondary.direction };
      }
      return { level: null, direction: '' };
    },
    [sort]
  );

  const sortData = useCallback(
    (data: T[]): T[] => {
      if (!sort.primary.column) return data;

      const getValue = (item: T, column: string): unknown => {
        if (valueGetter) {
          return valueGetter(item, column);
        }
        return (item as Record<string, unknown>)[column];
      };

      return [...data].sort((a, b) => {
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
          getValue(a, sort.primary.column),
          getValue(b, sort.primary.column),
          sort.primary.direction
        );

        if (primaryResult !== 0 || !sort.secondary.column) {
          return primaryResult;
        }

        return compareValues(
          getValue(a, sort.secondary.column),
          getValue(b, sort.secondary.column),
          sort.secondary.direction
        );
      });
    },
    [sort, valueGetter]
  );

  const setInitialSort = useCallback((viewSort: ViewSort) => {
    setSort(viewSort);
  }, []);

  return useMemo(
    () => ({
      sort,
      handleColumnClick,
      getSortInfo,
      sortData,
      setInitialSort,
    }),
    [sort, handleColumnClick, getSortInfo, sortData, setInitialSort]
  );
}
