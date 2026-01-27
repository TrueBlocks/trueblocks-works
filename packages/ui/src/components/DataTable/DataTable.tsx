import { ReactNode, forwardRef, CSSProperties } from 'react';
import { Table, Text, Stack, Loader } from '@mantine/core';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  width?: string | number;
  render?: (item: T) => ReactNode;
  headerElement?: ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowKey: (item: T) => string | number;
  selectedIndex?: number;
  onRowClick?: (item: T, index: number) => void;
  loading?: boolean;
  emptyMessage?: string;
  rowStyle?: (item: T) => CSSProperties | undefined;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  footer?: ReactNode;
  extraColumns?: ReactNode;
  renderExtraCells?: (item: T) => ReactNode;
  selectedRowRef?: React.Ref<HTMLTableRowElement>;
}

function DataTableInner<T>(
  props: DataTableProps<T>,
  ref: React.ForwardedRef<HTMLTableElement>
): ReactNode {
  const {
    data,
    columns,
    getRowKey,
    selectedIndex = -1,
    onRowClick,
    loading = false,
    emptyMessage = 'No data',
    rowStyle,
    headerLeft,
    headerRight,
    footer,
    extraColumns,
    renderExtraCells,
    selectedRowRef,
  } = props;

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      {(headerLeft || headerRight) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>{headerLeft}</div>
          <div>{headerRight}</div>
        </div>
      )}

      <Table ref={ref} striped highlightOnHover style={{ tableLayout: 'fixed', width: '100%' }}>
        <Table.Thead>
          <Table.Tr>
            {columns.map((col) => (
              <Table.Th key={col.key} style={{ width: col.width }}>
                {col.headerElement ?? col.header}
              </Table.Th>
            ))}
            {extraColumns}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={columns.length} style={{ textAlign: 'center' }}>
                <Text c="dimmed">{emptyMessage}</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            data.map((item, index) => {
              const isSelected = index === selectedIndex;
              const customStyle = rowStyle?.(item);

              return (
                <Table.Tr
                  key={getRowKey(item)}
                  ref={isSelected ? selectedRowRef : undefined}
                  onClick={() => onRowClick?.(item, index)}
                  style={{
                    cursor: onRowClick ? 'pointer' : undefined,
                    backgroundColor: isSelected ? 'var(--mantine-color-blue-light)' : undefined,
                    ...customStyle,
                  }}
                >
                  {columns.map((col) => (
                    <Table.Td key={col.key}>
                      {col.render
                        ? col.render(item)
                        : String((item as Record<string, unknown>)[col.key] ?? '')}
                    </Table.Td>
                  ))}
                  {renderExtraCells?.(item)}
                </Table.Tr>
              );
            })
          )}
        </Table.Tbody>
      </Table>

      {footer}
    </Stack>
  );
}

export const DataTable = forwardRef(DataTableInner) as <T>(
  props: DataTableProps<T> & { ref?: React.ForwardedRef<HTMLTableElement> }
) => ReactNode;
