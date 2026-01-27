import { GetTableState, SetTableState } from '@app';
import { state } from '@models';
import {
  DataTable as GenericDataTable,
  type DataTableProps as GenericDataTableProps,
} from '@trueblocks/ui';

export type { Column, DataTableProps } from '@trueblocks/ui';
export type { SortDirection, SortColumn, ViewSort } from '@trueblocks/ui';

type WailsDataTableProps<T> = Omit<GenericDataTableProps<T>, 'loadState' | 'saveState'>;

type SortDir = 'asc' | 'desc' | '';

interface TableState {
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: {
    primary: { column: string; direction: SortDir };
    secondary: { column: string; direction: SortDir };
    tertiary: { column: string; direction: SortDir };
    quaternary: { column: string; direction: SortDir };
  };
  filters?: Record<string, string[]>;
  rangeFilters?: Record<string, { min?: number; max?: number }>;
}

async function loadState(tableName: string): Promise<TableState> {
  const wailsState = await GetTableState(tableName);
  return {
    search: wailsState.search,
    page: wailsState.page,
    pageSize: wailsState.pageSize,
    sort: wailsState.sort
      ? {
          primary: {
            column: wailsState.sort.primary?.column || '',
            direction: (wailsState.sort.primary?.direction || '') as SortDir,
          },
          secondary: {
            column: wailsState.sort.secondary?.column || '',
            direction: (wailsState.sort.secondary?.direction || '') as SortDir,
          },
          tertiary: {
            column: wailsState.sort.tertiary?.column || '',
            direction: (wailsState.sort.tertiary?.direction || '') as SortDir,
          },
          quaternary: {
            column: wailsState.sort.quaternary?.column || '',
            direction: (wailsState.sort.quaternary?.direction || '') as SortDir,
          },
        }
      : undefined,
    filters: wailsState.filters,
    rangeFilters: wailsState.rangeFilters
      ? Object.fromEntries(
          Object.entries(wailsState.rangeFilters).map(([key, rf]) => [
            key,
            { min: rf.min ?? undefined, max: rf.max ?? undefined },
          ])
        )
      : undefined,
  };
}

async function saveState(tableName: string, tableState: TableState): Promise<void> {
  const rangeFiltersObj: Record<string, state.RangeFilter> = {};
  if (tableState.rangeFilters) {
    for (const [key, rf] of Object.entries(tableState.rangeFilters)) {
      rangeFiltersObj[key] = new state.RangeFilter({
        min: rf.min,
        max: rf.max,
      });
    }
  }
  const wailsState = new state.TableState({
    search: tableState.search,
    page: tableState.page,
    pageSize: tableState.pageSize,
    sort: tableState.sort
      ? new state.ViewSort({
          primary: new state.SortColumn(tableState.sort.primary),
          secondary: new state.SortColumn(tableState.sort.secondary),
          tertiary: new state.SortColumn(tableState.sort.tertiary),
          quaternary: new state.SortColumn(tableState.sort.quaternary),
        })
      : undefined,
    filters: tableState.filters,
    rangeFilters: rangeFiltersObj,
  });
  await SetTableState(tableName, wailsState);
}

export function DataTable<T>(props: WailsDataTableProps<T>) {
  return <GenericDataTable<T> {...props} loadState={loadState} saveState={saveState} />;
}
