import { ReactNode } from 'react';

export type FilterType = 'set' | 'range' | boolean;

export interface ColumnDef<T> {
  key: keyof T;
  label: string;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterable?: FilterType;
  filterOptions?: readonly string[];
  render?: (item: T) => ReactNode;
  sortValue?: (item: T) => string | number;
  getValue?: (item: T) => unknown;
}
