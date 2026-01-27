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

/**
 * A tab rendered in the detail view.
 * For "flat" entities, pass a single tab.
 * For hierarchical entities (like Collections), pass multiple tabs.
 */
export interface DetailTab<TEntity> {
  key: string;
  label: string;
  icon?: ReactNode;
  /**
   * Render function for the tab content.
   * Receives the entity and a reload function.
   */
  render: (entity: TEntity, reload: () => Promise<void>) => ReactNode;
}

/**
 * Configuration for child entities within a parent.
 * Used for hierarchical navigation (e.g., Works within a Collection).
 */
export interface ChildEntityConfig<TId = number> {
  /**
   * Fetch child entities for a given parent ID.
   * Returns array of child items (must have `id` field).
   */
  fetchForParent: (parentId: TId) => Promise<Array<{ id: number }>>;
  /**
   * Entity type of the child (e.g., 'work').
   */
  childEntityType: string;
  /**
   * Generate the route path for a child detail.
   */
  getChildRoute: (parentId: TId, childId: number) => string;
}

export interface EntityContract<TEntity, TId = number> {
  entityType: string;
  entityName: string;
  pluralName: string;
  idField: keyof TEntity;

  columns: ColumnDef<TEntity>[];
  fields: FieldDef<TEntity>[];

  actions: EntityActions<TId>;

  /**
   * Optional tabs for the detail view.
   * If omitted or single tab, renders as flat detail.
   * If multiple tabs, renders with tab navigation.
   */
  detailTabs?: DetailTab<TEntity>[];

  /**
   * Optional child entity configuration for hierarchical navigation.
   */
  children?: ChildEntityConfig<TId>;
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
