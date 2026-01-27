import { ReactNode } from 'react';
import type { ColumnDef } from './ColumnDef';
import type { FieldDef } from './FieldDef';

export interface DeleteConfirmation {
  title: string;
  message: string;
  consequences?: string[];
  confirmLabel?: string;
}

export interface EntityActions<TId = number> {
  list: () => Promise<unknown[]>;
  get: (id: TId) => Promise<unknown>;
  update?: (id: TId, data: unknown) => Promise<void>;
  create?: (data: unknown) => Promise<unknown>;
  delete?: (id: TId) => Promise<void>;
  undelete?: (id: TId) => Promise<void>;
  permanentDelete?: (id: TId) => Promise<void>;
  getDeleteConfirmation?: (id: TId) => Promise<DeleteConfirmation>;
}

export interface EntityContract<TEntity, TId = number> {
  entityType: string;
  entityName: string;
  pluralName: string;
  idField: keyof TEntity;

  columns: ColumnDef<TEntity>[];
  fields: FieldDef<TEntity>[];

  actions: EntityActions<TId>;

  children?: {
    fetchForParent: (parentId: TId) => Promise<unknown[]>;
    parentKey: string;
  };
}

export interface PortalDef {
  key: string;
  title: string;
  icon: ReactNode;
  component: React.ComponentType<{ entityId: number }>;
  defaultOpen?: boolean;
}

export interface DeletableEntity {
  isDeleted: boolean;
}
