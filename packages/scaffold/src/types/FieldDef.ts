import { ReactNode } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export type FieldType = 'text' | 'select' | 'date' | 'number' | 'readonly' | 'textarea';

export interface FieldDef<T> {
  key: keyof T & string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: SelectOption[] | (() => Promise<SelectOption[]>);
  render?: (value: T[keyof T], item: T) => ReactNode;
  editable?: boolean;
  span?: number;
}
