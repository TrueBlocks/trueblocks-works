import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Table,
  TextInput,
  Text,
  Stack,
  Group,
  Pagination,
  Select,
  Title,
  CloseButton,
} from '@mantine/core';
import { useDebouncedValue, useHotkeys } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { SortableHeader } from '../SortableHeader';
import { ColumnFilterPopover } from './ColumnFilterPopover';
import { NumericFilterPopover } from './NumericFilterPopover';
import { DataTableRow } from './DataTableRow';
import type { DataTableProps, SortDirection, SortColumn, ViewSort, TableState } from './types';
import './DataTable.css';

const PAGE_SIZE_OPTIONS = [
  { value: '20', label: '20 per page' },
  { value: '50', label: '50 per page' },
  { value: '100', label: '100 per page' },
  { value: '250', label: '250 per page' },
];

const emptySortColumn: SortColumn = { column: '', direction: '' };
const emptyViewSort: ViewSort = {
  primary: emptySortColumn,
  secondary: emptySortColumn,
  tertiary: emptySortColumn,
  quaternary: emptySortColumn,
};

export function DataTable<T>({
  tableName,
  title,
  titleOrder = 2,
  data,
  columns,
  loading = false,
  getRowKey,
  onRowClick,
  onSelectedChange,
  onFilteredSortedChange,
  getLastSelectedID,
  valueGetter,
  extraColumns,
  renderExtraCells,
  headerActions,
  searchFn,
  onDelete,
  onUndelete,
  onPermanentDelete,
  canDelete,
  onReorder,
  onMoveToPosition,
  onSortFilterStateChange,
  getRowStyle,
  loadState,
  saveState,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 200);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sort, setSort] = useState<ViewSort>(emptyViewSort);
  const [filters, setFilters] = useState<Record<string, Set<string>>>({});
  const [rangeFilters, setRangeFilters] = useState<Record<string, { min?: number; max?: number }>>(
    {}
  );
  const [stateLoaded, setStateLoaded] = useState(!loadState); // If no loadState, consider already loaded
  const [selectionRestored, setSelectionRestored] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const selectedRowRef = useRef<HTMLTableRowElement>(null);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load state on mount (if loadState is provided)
  useEffect(() => {
    if (!loadState) return;

    loadState(tableName).then((tableState) => {
      if (tableState.search) setSearch(tableState.search);
      if (tableState.page) setPage(tableState.page);
      if (tableState.pageSize) setPageSize(tableState.pageSize);
      if (tableState.sort?.primary?.column) {
        setSort({
          primary: {
            column: tableState.sort.primary.column || '',
            direction: (tableState.sort.primary.direction as SortDirection) || '',
          },
          secondary: {
            column: tableState.sort.secondary?.column || '',
            direction: (tableState.sort.secondary?.direction as SortDirection) || '',
          },
          tertiary: {
            column: tableState.sort.tertiary?.column || '',
            direction: (tableState.sort.tertiary?.direction as SortDirection) || '',
          },
          quaternary: {
            column: tableState.sort.quaternary?.column || '',
            direction: (tableState.sort.quaternary?.direction as SortDirection) || '',
          },
        });
      }
      if (tableState.filters) {
        const restored: Record<string, Set<string>> = {};
        for (const [key, values] of Object.entries(tableState.filters)) {
          restored[key] = new Set(values);
        }
        setFilters(restored);
      }
      if (tableState.rangeFilters) {
        const restored: Record<string, { min?: number; max?: number }> = {};
        for (const [key, rf] of Object.entries(tableState.rangeFilters)) {
          const entry: { min?: number; max?: number } = {};
          if (rf.min !== undefined) entry.min = rf.min;
          if (rf.max !== undefined) entry.max = rf.max;
          restored[key] = entry;
        }
        setRangeFilters(restored);
      }
      setStateLoaded(true);
    });
  }, [tableName, loadState]);

  useEffect(() => {
    if (!stateLoaded) return;

    columns.forEach((col) => {
      if (col.filterOptions && !filters[col.key]) {
        setFilters((prev) => ({ ...prev, [col.key]: new Set(col.filterOptions) }));
      }
    });
  }, [stateLoaded, columns, filters]);

  const persistState = useCallback(() => {
    if (!saveState) return;

    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }
    persistTimeoutRef.current = setTimeout(() => {
      const filtersObj: Record<string, string[]> = {};
      for (const [key, values] of Object.entries(filters)) {
        filtersObj[key] = Array.from(values);
      }
      const rangeFiltersObj: Record<string, { min?: number; max?: number }> = {};
      for (const [key, rf] of Object.entries(rangeFilters)) {
        const entry: { min?: number; max?: number } = {};
        if (rf.min !== undefined) entry.min = rf.min;
        if (rf.max !== undefined) entry.max = rf.max;
        rangeFiltersObj[key] = entry;
      }
      const tableState: TableState = {
        search,
        page,
        pageSize,
        sort,
        filters: filtersObj,
        rangeFilters: rangeFiltersObj,
      };
      saveState(tableName, tableState);
    }, 300);
  }, [tableName, search, page, pageSize, sort, filters, rangeFilters, saveState]);

  useEffect(() => {
    if (stateLoaded) {
      persistState();
    }
  }, [stateLoaded, persistState]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
    setSelectedIndex(0);
  }, []);

  // Check if any filter is not in "All" mode
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

  // Disable reordering when sort, filter, or search is active
  const canReorder = useMemo(() => {
    if (!onReorder) return false;
    if (debouncedSearch) return false;
    if (hasActiveFilters) return false;
    if (sort.primary.column) return false;
    return true;
  }, [onReorder, debouncedSearch, hasActiveFilters, sort.primary.column]);

  const handleClearAll = useCallback(() => {
    setSearch('');
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
        } else {
          return { ...prev, primary: { column, direction: 'asc' } };
        }
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
        } else {
          return { ...prev, secondary: { column, direction: 'asc' } };
        }
      } else if (prev.tertiary.column === column) {
        if (prev.tertiary.direction === 'asc') {
          return { ...prev, tertiary: { column, direction: 'desc' } };
        } else if (prev.tertiary.direction === 'desc') {
          return {
            ...prev,
            tertiary: prev.quaternary,
            quaternary: emptySortColumn,
          };
        } else {
          return { ...prev, tertiary: { column, direction: 'asc' } };
        }
      } else if (prev.quaternary.column === column) {
        if (prev.quaternary.direction === 'asc') {
          return { ...prev, quaternary: { column, direction: 'desc' } };
        } else if (prev.quaternary.direction === 'desc') {
          return { ...prev, quaternary: emptySortColumn };
        } else {
          return { ...prev, quaternary: { column, direction: 'asc' } };
        }
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
      const current = prev[columnKey] || new Set();
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
    setFilters((prev) => ({ ...prev, [columnKey]: new Set() }));
  }, []);

  const handleFilterSelectOnly = useCallback((columnKey: string, value: string) => {
    setFilters((prev) => ({ ...prev, [columnKey]: new Set([value]) }));
  }, []);

  const handleRangeFilterChange = useCallback(
    (columnKey: string, min: number | undefined, max: number | undefined) => {
      setRangeFilters((prev) => {
        const entry: { min?: number; max?: number } = {};
        if (min !== undefined) entry.min = min;
        if (max !== undefined) entry.max = max;
        return { ...prev, [columnKey]: entry };
      });
    },
    []
  );

  const getValue = useCallback(
    (item: T, column: string): unknown => {
      if (valueGetter) {
        return valueGetter(item, column);
      }
      return (item as Record<string, unknown>)[column];
    },
    [valueGetter]
  );

  const filtered = useMemo(() => {
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

  const sorted = useMemo(() => {
    if (!sort.primary.column) return filtered;

    const getSortValue = (item: T, columnKey: string): unknown => {
      const col = columns.find((c) => c.key === columnKey);
      if (col?.sortValue) {
        return col.sortValue(item);
      }
      return getValue(item, columnKey);
    };

    return [...filtered].sort((a, b) => {
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
  }, [filtered, sort, getValue, columns]);

  const totalPages = Math.ceil(sorted.length / pageSize);

  const effectivePage = useMemo(() => {
    if (page > totalPages && totalPages > 0) {
      return totalPages;
    }
    return page;
  }, [page, totalPages]);

  const paginated = useMemo(() => {
    const start = (effectivePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, effectivePage, pageSize]);

  useEffect(() => {
    if (onFilteredSortedChange) {
      onFilteredSortedChange(sorted);
    }
  }, [sorted, onFilteredSortedChange]);

  useEffect(() => {
    if (onSortFilterStateChange) {
      const hasActiveFiltersCalc =
        Object.entries(filters).some(([key, selected]) => {
          const col = columns.find((c) => c.key === key);
          return (
            col?.filterOptions && selected.size > 0 && selected.size < col.filterOptions.length
          );
        }) ||
        Object.values(rangeFilters).some((rf) => rf.min !== undefined || rf.max !== undefined) ||
        debouncedSearch.length > 0;
      const hasActiveSort = sort.primary.column !== '';
      onSortFilterStateChange({ hasActiveFilters: hasActiveFiltersCalc, hasActiveSort });
    }
  }, [filters, rangeFilters, sort, debouncedSearch, columns, onSortFilterStateChange]);

  useEffect(() => {
    async function restoreSelection() {
      if (!getLastSelectedID || selectionRestored || sorted.length === 0 || !stateLoaded) {
        return;
      }

      const lastID = await getLastSelectedID();
      if (lastID) {
        const globalIndex = sorted.findIndex((item) => getRowKey(item) === lastID);
        if (globalIndex >= 0) {
          const newPage = Math.floor(globalIndex / pageSize) + 1;
          const newLocalIndex = globalIndex % pageSize;
          setPage(newPage);
          setSelectedIndex(newLocalIndex);
          setSelectionRestored(true);
        }
      }
    }

    restoreSelection();
  }, [getLastSelectedID, selectionRestored, sorted, stateLoaded, pageSize, getRowKey]);

  useEffect(() => {
    if (selectionRestored && selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [selectionRestored, effectivePage]);

  const effectiveSelectedIndex = useMemo(() => {
    if (selectedIndex >= paginated.length && paginated.length > 0) {
      return paginated.length - 1;
    }
    return selectedIndex;
  }, [selectedIndex, paginated.length]);

  useEffect(() => {
    if (paginated.length > 0 && effectiveSelectedIndex >= 0) {
      const item = paginated[effectiveSelectedIndex];
      if (item) onSelectedChange?.(item);
    }
  }, [paginated, effectiveSelectedIndex, onSelectedChange]);

  const handlePageSizeChange = useCallback((value: string | null) => {
    if (value) {
      setPageSize(parseInt(value, 10));
      setPage(1);
      setSelectedIndex(0);
    }
  }, []);

  const globalIndex = useMemo(() => {
    return (effectivePage - 1) * pageSize + effectiveSelectedIndex;
  }, [effectivePage, pageSize, effectiveSelectedIndex]);

  const navigateToGlobalIndex = useCallback(
    (newGlobalIndex: number) => {
      if (sorted.length === 0) return;
      const clampedIndex = Math.max(0, Math.min(newGlobalIndex, sorted.length - 1));
      const newPage = Math.floor(clampedIndex / pageSize) + 1;
      const newLocalIndex = clampedIndex % pageSize;
      setPage(newPage);
      setSelectedIndex(newLocalIndex);
      const item = sorted[clampedIndex];
      if (item) onSelectedChange?.(item);
    },
    [sorted, pageSize, onSelectedChange]
  );

  const handleRowClick = useCallback(
    (item: T, index: number) => {
      setSelectedIndex(index);
      onSelectedChange?.(item);
      onRowClick?.(item);
    },
    [onRowClick, onSelectedChange]
  );

  const handleReorderPageChange = useCallback(
    (direction: 'up' | 'down', index: number) => {
      if (direction === 'up' && index === 0 && effectivePage > 1) {
        setPage(effectivePage - 1);
      } else if (direction === 'down' && index === pageSize - 1 && effectivePage < totalPages) {
        setPage(effectivePage + 1);
      }
    },
    [effectivePage, pageSize, totalPages]
  );

  useHotkeys([
    ['mod+/', () => searchRef.current?.focus()],
    [
      'ArrowRight',
      () => {
        if (page < totalPages) {
          setPage(page + 1);
        } else if (effectiveSelectedIndex < paginated.length - 1) {
          setSelectedIndex(paginated.length - 1);
        }
      },
    ],
    [
      'ArrowLeft',
      () => {
        if (page > 1) {
          setPage(page - 1);
        } else if (effectiveSelectedIndex > 0) {
          setSelectedIndex(0);
        }
      },
    ],
    [
      'ArrowDown',
      () => {
        navigateToGlobalIndex(globalIndex + 1);
      },
    ],
    [
      'ArrowUp',
      () => {
        navigateToGlobalIndex(globalIndex - 1);
      },
    ],
    [
      'Home',
      () => {
        navigateToGlobalIndex(0);
      },
    ],
    [
      'End',
      () => {
        navigateToGlobalIndex(sorted.length - 1);
      },
    ],
    [
      'Enter',
      () => {
        if (paginated[effectiveSelectedIndex]) {
          onRowClick?.(paginated[effectiveSelectedIndex]);
        }
      },
    ],
  ]);

  if (loading) {
    return (
      <Stack>
        {title && (
          <Group justify="space-between">
            <Title order={2}>{title}</Title>
          </Group>
        )}
        <Text>Loading...</Text>
      </Stack>
    );
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          {title && (
            <Title order={titleOrder}>
              {title} ({sorted.length})
            </Title>
          )}
          <Group gap="xs">
            <Select
              size="xs"
              w={130}
              value={String(pageSize)}
              onChange={handlePageSizeChange}
              data={PAGE_SIZE_OPTIONS}
            />
            {totalPages > 1 && (
              <Pagination size="sm" total={totalPages} value={effectivePage} onChange={setPage} />
            )}
          </Group>
        </Group>
        <Group>
          {headerActions}
          <TextInput
            ref={searchRef}
            placeholder={`Search ${(title || 'items').toLowerCase()}...`}
            leftSection={<IconSearch size={16} />}
            rightSection={
              search || hasActiveFilters || sort.primary.column ? (
                <CloseButton size="sm" c="dimmed" onClick={handleClearAll} />
              ) : null
            }
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                searchRef.current?.blur();
              }
            }}
            w={300}
          />
        </Group>
      </Group>

      <Table
        ref={tableRef}
        striped
        highlightOnHover
        className="data-table"
        style={{ tableLayout: 'fixed', width: '100%' }}
      >
        <Table.Thead>
          <Table.Tr>
            {columns.map((col) => {
              const sortInfo = getSortInfo(col.key);
              let filterElement = col.filterElement;
              if (!filterElement && col.filterOptions) {
                const selected = filters[col.key] || new Set(col.filterOptions);
                const worksHandler = col.isWorkTypeColumn
                  ? () => {
                      const works = col.filterOptions!.filter((t) => !t.includes('Idea'));
                      setFilters((prev) => ({ ...prev, [col.key]: new Set(works) }));
                    }
                  : undefined;
                const ideasHandler = col.isWorkTypeColumn
                  ? () => {
                      const ideas = col.filterOptions!.filter((t) => t.includes('Idea'));
                      setFilters((prev) => ({ ...prev, [col.key]: new Set(ideas) }));
                    }
                  : undefined;
                filterElement = (
                  <ColumnFilterPopover
                    options={col.filterOptions}
                    selected={selected}
                    onChange={(value) => handleFilterToggle(col.key, value)}
                    onSelectAll={() => handleFilterSelectAll(col.key)}
                    onSelectNone={() => handleFilterSelectNone(col.key)}
                    onSelectOnly={(value) => handleFilterSelectOnly(col.key, value)}
                    {...(worksHandler ? { onSelectWorks: worksHandler } : {})}
                    {...(ideasHandler ? { onSelectIdeas: ideasHandler } : {})}
                    label={col.label}
                  />
                );
              }
              if (!filterElement && col.filterRange) {
                const rf = rangeFilters[col.key] || {};
                filterElement = (
                  <NumericFilterPopover
                    min={rf.min}
                    max={rf.max}
                    onChange={(min, max) => handleRangeFilterChange(col.key, min, max)}
                    label={col.label}
                  />
                );
              }
              return (
                <SortableHeader
                  key={col.key}
                  label={col.label}
                  column={col.key}
                  level={sortInfo.level}
                  direction={sortInfo.direction}
                  onClick={handleColumnClick}
                  style={{ width: col.width }}
                  filterElement={filterElement}
                />
              );
            })}
            {onReorder && <Table.Th style={{ width: '50px' }} />}
            {extraColumns}
            {(onDelete || onUndelete) && (
              <Table.Th style={{ width: '80px', textAlign: 'center' }}>Actions</Table.Th>
            )}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {paginated.map((item, index) => {
            const isDeleted = (item as { isDeleted?: boolean }).isDeleted || false;
            const globalIdx = (effectivePage - 1) * pageSize + index;
            return (
              <DataTableRow<T>
                key={getRowKey(item)}
                ref={index === effectiveSelectedIndex ? selectedRowRef : null}
                item={item}
                index={index}
                columns={columns}
                isSelected={index === effectiveSelectedIndex}
                isDeleted={isDeleted}
                hasClickHandler={!!onRowClick}
                getRowKey={getRowKey}
                onClick={handleRowClick}
                canReorder={canReorder}
                isFirstInList={globalIdx === 0}
                isLastInList={globalIdx >= sorted.length - 1}
                {...(onDelete ? { onDelete } : {})}
                {...(onUndelete ? { onUndelete } : {})}
                {...(onPermanentDelete ? { onPermanentDelete } : {})}
                {...(onReorder ? { onReorder } : {})}
                {...(onMoveToPosition ? { onMoveToPosition } : {})}
                {...(renderExtraCells ? { renderExtraCells } : {})}
                {...(canDelete ? { canDelete } : {})}
                {...(getRowStyle ? { getRowStyle } : {})}
                onReorderPageChange={handleReorderPageChange}
              />
            );
          })}
        </Table.Tbody>
      </Table>

      <Text size="sm" c="dimmed">
        Showing {paginated.length} of {sorted.length} {(title || 'items').toLowerCase()}
        {sorted.length !== data.length && ` (${data.length} total)`}
      </Text>
    </Stack>
  );
}
