import { useState, useEffect, useCallback, useMemo } from 'react';
import type { EntityContract, DeleteConfirmation } from '../types';
import { useDeleteFlow } from '../hooks';
import { useNavigation } from '../context';

export interface EntityListProps<T> {
  showDeleted?: boolean;
  onSelect?: (item: T) => void;
  onDoubleClick?: (item: T) => void;
}

export interface EntityListReturn<T> {
  items: T[];
  filteredItems: T[];
  loading: boolean;
  error: string | null;
  selectedId: number | null;
  searchValue: string;
  sortField: keyof T | null;
  sortDirection: 'asc' | 'desc';

  setSearchValue: (value: string) => void;
  setSortField: (field: keyof T | null) => void;
  setSortDirection: (direction: 'asc' | 'desc') => void;
  setSelectedId: (id: number | null) => void;
  reload: () => Promise<void>;

  deleteModalOpen: boolean;
  deleteConfirmation: DeleteConfirmation | null;
  deleteLoading: boolean;
  handleDelete: (id: number) => Promise<void>;
  handleUndelete: (id: number) => Promise<void>;
  handlePermanentDeleteClick: (id: number) => Promise<void>;
  handlePermanentDeleteConfirm: () => Promise<void>;
  handleDeleteModalClose: () => void;

  handleKeyDown: (e: React.KeyboardEvent) => void;
  getRowClassName: (item: T) => string;
}

export function createEntityList<T extends { id: number; isDeleted: boolean }>(
  contract: EntityContract<T, number>
): (props: EntityListProps<T>) => EntityListReturn<T> {
  return function useEntityList(props: EntityListProps<T>): EntityListReturn<T> {
    const { showDeleted = false, onSelect, onDoubleClick } = props;
    const navigation = useNavigation();
    const currentId = navigation.currentId;

    const [items, setItemsState] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchValue, setSearchValue] = useState('');
    const [sortField, setSortField] = useState<keyof T | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const reload = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = (await contract.actions.list()) as T[];
        setItemsState(data);
        const firstId = data.length > 0 ? (data[0]?.id ?? 0) : 0;
        navigation.setItems(contract.entityType, data, currentId ?? firstId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }, [contract, navigation, currentId]);

    useEffect(() => {
      void reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      const handler = () => void reload();
      window.addEventListener(`${contract.entityType}:reload`, handler);
      return () => window.removeEventListener(`${contract.entityType}:reload`, handler);
    }, [reload, contract.entityType]);

    const filteredItems = useMemo(() => {
      let result = items;

      if (!showDeleted) {
        result = result.filter((item) => !item.isDeleted);
      }

      if (searchValue.trim()) {
        const lower = searchValue.toLowerCase();
        result = result.filter((item) => {
          return contract.columns.some((col) => {
            const value = item[col.key];
            if (typeof value === 'string') {
              return value.toLowerCase().includes(lower);
            }
            if (typeof value === 'number') {
              return value.toString().includes(lower);
            }
            return false;
          });
        });
      }

      if (sortField !== null) {
        result = [...result].sort((a, b) => {
          const aVal = a[sortField];
          const bVal = b[sortField];
          if (aVal === bVal) return 0;
          if (aVal === null || aVal === undefined) return 1;
          if (bVal === null || bVal === undefined) return -1;
          const cmp = aVal < bVal ? -1 : 1;
          return sortDirection === 'asc' ? cmp : -cmp;
        });
      }

      return result;
    }, [items, showDeleted, searchValue, sortField, sortDirection, contract.columns]);

    const deleteFlow = useDeleteFlow<number>({
      entityName: contract.entityName,
      actions: contract.actions,
      onDeleted: () => void reload(),
      onUndeleted: () => void reload(),
      onPermanentlyDeleted: () => void reload(),
    });

    const selectedIndex = useMemo(() => {
      if (currentId === null) return -1;
      return filteredItems.findIndex((item) => item.id === currentId);
    }, [filteredItems, currentId]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (filteredItems.length === 0) return;

        switch (e.key) {
          case 'ArrowDown': {
            e.preventDefault();
            const nextIndex =
              selectedIndex < filteredItems.length - 1 ? selectedIndex + 1 : selectedIndex;
            const nextItem = filteredItems[nextIndex];
            if (nextItem) {
              navigation.setCurrentId(nextItem.id);
              onSelect?.(nextItem);
            }
            break;
          }
          case 'ArrowUp': {
            e.preventDefault();
            const prevIndex = selectedIndex > 0 ? selectedIndex - 1 : 0;
            const prevItem = filteredItems[prevIndex];
            if (prevItem) {
              navigation.setCurrentId(prevItem.id);
              onSelect?.(prevItem);
            }
            break;
          }
          case 'Home': {
            e.preventDefault();
            const firstItem = filteredItems[0];
            if (firstItem) {
              navigation.setCurrentId(firstItem.id);
              onSelect?.(firstItem);
            }
            break;
          }
          case 'End': {
            e.preventDefault();
            const lastItem = filteredItems[filteredItems.length - 1];
            if (lastItem) {
              navigation.setCurrentId(lastItem.id);
              onSelect?.(lastItem);
            }
            break;
          }
          case 'Enter': {
            if (currentId !== null) {
              const item = filteredItems.find((i) => i.id === currentId);
              if (item) {
                onDoubleClick?.(item);
              }
            }
            break;
          }
        }
      },
      [filteredItems, selectedIndex, currentId, navigation, onSelect, onDoubleClick]
    );

    const getRowClassName = useCallback(
      (item: T) => {
        const classes: string[] = [];
        if (item.isDeleted) {
          classes.push('deleted-row');
        }
        if (item.id === currentId) {
          classes.push('selected-row');
        }
        return classes.join(' ');
      },
      [currentId]
    );

    const setSelectedId = useCallback(
      (id: number | null) => {
        if (id !== null) {
          navigation.setCurrentId(id);
        }
      },
      [navigation]
    );

    return {
      items,
      filteredItems,
      loading,
      error,
      selectedId: currentId,
      searchValue,
      sortField,
      sortDirection,
      setSearchValue,
      setSortField,
      setSortDirection,
      setSelectedId,
      reload,
      deleteModalOpen: deleteFlow.deleteModalOpen,
      deleteConfirmation: deleteFlow.deleteConfirmation,
      deleteLoading: deleteFlow.deleteLoading,
      handleDelete: deleteFlow.handleDelete,
      handleUndelete: deleteFlow.handleUndelete,
      handlePermanentDeleteClick: deleteFlow.handlePermanentDeleteClick,
      handlePermanentDeleteConfirm: deleteFlow.handlePermanentDeleteConfirm,
      handleDeleteModalClose: deleteFlow.handleDeleteModalClose,
      handleKeyDown,
      getRowClassName,
    };
  };
}
