import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Table,
  TextInput,
  Group,
  Text,
  Stack,
  Pagination,
  Select,
  Title,
  CloseButton,
} from '@mantine/core';
import { useDebouncedValue, useHotkeys } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { SortableHeader } from './SortableHeader';
import { useTableSort, ViewSort } from '@/hooks';

export interface Column<T> {
  key: string;
  label: string;
  width?: string;
  render?: (item: T) => React.ReactNode;
  filterElement?: React.ReactNode;
}

interface DataTableProps<T> {
  title: string;
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  getRowKey: (item: T) => string | number;
  onRowClick?: (item: T) => void;
  filterFn: (item: T, search: string) => boolean;
  initialSearch?: string;
  onSearchChange?: (value: string) => void;
  viewName: string;
  initialSort?: ViewSort;
  valueGetter?: (item: T, column: string) => unknown;
  extraColumns?: React.ReactNode;
  renderExtraCells?: (item: T) => React.ReactNode;
  headerActions?: React.ReactNode;
  pageSize?: number;
}

const PAGE_SIZE_OPTIONS = [
  { value: '20', label: '20 per page' },
  { value: '50', label: '50 per page' },
  { value: '100', label: '100 per page' },
  { value: '250', label: '250 per page' },
];

export function DataTable<T>({
  title,
  data,
  columns,
  loading = false,
  getRowKey,
  onRowClick,
  filterFn,
  initialSearch = '',
  onSearchChange,
  viewName,
  initialSort,
  valueGetter,
  extraColumns,
  renderExtraCells,
  headerActions,
  pageSize: initialPageSize = 20,
}: DataTableProps<T>) {
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch] = useDebouncedValue(search, 200);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const { handleColumnClick, getSortInfo, sortData, setInitialSort } = useTableSort<T>(
    viewName,
    initialSort,
    valueGetter
  );

  useEffect(() => {
    if (initialSort) {
      setInitialSort(initialSort);
    }
  }, [initialSort, setInitialSort]);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      setPage(1);
      setSelectedIndex(0);
      onSearchChange?.(value);
    },
    [onSearchChange]
  );

  const filtered = useMemo(() => {
    return data.filter((item) => filterFn(item, debouncedSearch));
  }, [data, debouncedSearch, filterFn]);

  const sorted = useMemo(() => {
    return sortData(filtered);
  }, [filtered, sortData]);

  const totalPages = Math.ceil(sorted.length / pageSize);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (selectedIndex >= paginated.length && paginated.length > 0) {
      setSelectedIndex(paginated.length - 1);
    }
  }, [selectedIndex, paginated.length]);

  const handlePageSizeChange = useCallback((value: string | null) => {
    if (value) {
      setPageSize(parseInt(value, 10));
      setPage(1);
      setSelectedIndex(0);
    }
  }, []);

  const globalIndex = useMemo(() => {
    return (page - 1) * pageSize + selectedIndex;
  }, [page, pageSize, selectedIndex]);

  const navigateToGlobalIndex = useCallback(
    (newGlobalIndex: number) => {
      if (sorted.length === 0) return;
      const clampedIndex = Math.max(0, Math.min(newGlobalIndex, sorted.length - 1));
      const newPage = Math.floor(clampedIndex / pageSize) + 1;
      const newLocalIndex = clampedIndex % pageSize;
      setPage(newPage);
      setSelectedIndex(newLocalIndex);
    },
    [sorted.length, pageSize]
  );

  const handleRowClick = useCallback(
    (item: T, index: number) => {
      setSelectedIndex(index);
      onRowClick?.(item);
    },
    [onRowClick]
  );

  useHotkeys([
    ['mod+/', () => searchRef.current?.focus()],
    [
      'ArrowRight',
      () => {
        if (page < totalPages) {
          setPage(page + 1);
          setSelectedIndex(0);
        }
      },
    ],
    [
      'ArrowLeft',
      () => {
        if (page > 1) {
          setPage(page - 1);
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
        if (paginated[selectedIndex]) {
          onRowClick?.(paginated[selectedIndex]);
        }
      },
    ],
  ]);

  if (loading) {
    return (
      <Stack>
        <Group justify="space-between">
          <Title order={2}>{title}</Title>
        </Group>
        <Text>Loading...</Text>
      </Stack>
    );
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Title order={2}>
            {title} ({sorted.length})
          </Title>
          <Group gap="xs">
            <Select
              size="xs"
              w={130}
              value={String(pageSize)}
              onChange={handlePageSizeChange}
              data={PAGE_SIZE_OPTIONS}
            />
            {totalPages > 1 && (
              <Pagination size="sm" total={totalPages} value={page} onChange={setPage} />
            )}
          </Group>
        </Group>
        <Group>
          {headerActions}
          <TextInput
            ref={searchRef}
            placeholder={`Search ${title.toLowerCase()}...`}
            leftSection={<IconSearch size={16} />}
            rightSection={
              search ? (
                <CloseButton size="sm" c="dimmed" onClick={() => handleSearchChange('')} />
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
        style={{ tableLayout: 'fixed', width: '100%' }}
      >
        <Table.Thead>
          <Table.Tr>
            {columns.map((col) => {
              const sortInfo = getSortInfo(col.key);
              return (
                <SortableHeader
                  key={col.key}
                  label={col.label}
                  column={col.key}
                  level={sortInfo.level}
                  direction={sortInfo.direction}
                  onClick={handleColumnClick}
                  style={{ width: col.width }}
                  filterElement={col.filterElement}
                />
              );
            })}
            {extraColumns}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {paginated.map((item, index) => (
            <Table.Tr
              key={getRowKey(item)}
              style={{
                cursor: onRowClick ? 'pointer' : 'default',
                backgroundColor:
                  index === selectedIndex ? 'var(--mantine-color-blue-light)' : undefined,
              }}
              onClick={() => handleRowClick(item, index)}
            >
              {columns.map((col) => (
                <Table.Td key={col.key}>
                  {col.render
                    ? col.render(item)
                    : String((item as Record<string, unknown>)[col.key] ?? '-')}
                </Table.Td>
              ))}
              {renderExtraCells?.(item)}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Text size="sm" c="dimmed">
        Showing {paginated.length} of {sorted.length} {title.toLowerCase()}
        {sorted.length !== data.length && ` (${data.length} total)`}
      </Text>
    </Stack>
  );
}
