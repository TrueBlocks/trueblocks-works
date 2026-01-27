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
  min?: number | undefined;
  max?: number | undefined;
}

export interface TableState {
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: ViewSort;
  filters?: Record<string, string[]>;
  rangeFilters?: Record<string, RangeFilter>;
}

export interface Column<T> {
  key: string;
  label: string;
  width?: string;
  render?: (item: T) => React.ReactNode;
  sortValue?: (item: T) => string | number;
  filterOptions?: readonly string[];
  filterRange?: boolean;
  filterElement?: React.ReactNode;
  scrollOnSelect?: boolean;
  isWorkTypeColumn?: boolean;
}

export interface DataTableProps<T> {
  tableName: string;
  title?: string;
  titleOrder?: 1 | 2 | 3 | 4 | 5 | 6;
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  getRowKey: (item: T) => string | number;
  onRowClick?: (item: T) => void;
  onSelectedChange?: (item: T) => void;
  onFilteredSortedChange?: (items: T[]) => void;
  getLastSelectedID?: () => Promise<number | null | undefined>;
  valueGetter?: (item: T, column: string) => unknown;
  extraColumns?: React.ReactNode;
  renderExtraCells?: (item: T) => React.ReactNode;
  headerActions?: React.ReactNode;
  searchFn?: (item: T, search: string) => boolean;
  onDelete?: (item: T) => void | Promise<void>;
  onUndelete?: (item: T) => void | Promise<void>;
  onPermanentDelete?: (item: T) => void | Promise<void>;
  canDelete?: (item: T) => boolean;
  onReorder?: (itemKey: string | number, direction: 'up' | 'down') => void;
  onMoveToPosition?: (itemKey: string | number, currentIndex: number) => void;
  onSortFilterStateChange?: (state: { hasActiveFilters: boolean; hasActiveSort: boolean }) => void;
  getRowStyle?: (item: T) => React.CSSProperties | undefined;
  // Persistence - optional. If not provided, state is ephemeral
  loadState?: (tableName: string) => Promise<TableState>;
  saveState?: (tableName: string, state: TableState) => Promise<void>;
}
