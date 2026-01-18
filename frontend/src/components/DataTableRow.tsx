import { forwardRef, memo } from 'react';
import { Table, ActionIcon, Group, Tooltip } from '@mantine/core';
import { IconTrash, IconRestore, IconX, IconChevronUp, IconChevronDown } from '@tabler/icons-react';
import { Column } from './DataTable';
import { DataTableCell } from './DataTableCell';

export interface DataTableRowProps<T> {
  item: T;
  index: number;
  columns: Column<T>[];
  isSelected: boolean;
  isDeleted: boolean;
  hasClickHandler: boolean;
  getRowKey: (item: T) => string | number;
  onClick: (item: T, index: number) => void;
  onDelete?: (item: T) => void;
  onUndelete?: (item: T) => void;
  onPermanentDelete?: (item: T) => void;
  onReorder?: (itemKey: string | number, direction: 'up' | 'down') => void;
  onReorderPageChange?: (direction: 'up' | 'down', index: number) => void;
  renderExtraCells?: (item: T) => React.ReactNode;
  canDelete?: (item: T) => boolean;
  canReorder: boolean;
  isFirstInList: boolean;
  isLastInList: boolean;
}

function DataTableRowInner<T>(
  {
    item,
    index,
    columns,
    isSelected,
    isDeleted,
    hasClickHandler,
    getRowKey,
    onClick,
    onDelete,
    onUndelete,
    onPermanentDelete,
    onReorder,
    onReorderPageChange,
    renderExtraCells,
    canDelete,
    canReorder,
    isFirstInList,
    isLastInList,
  }: DataTableRowProps<T>,
  ref: React.ForwardedRef<HTMLTableRowElement>
) {
  const showActions = onDelete || onUndelete || onPermanentDelete;
  const canDeleteItem = canDelete?.(item) ?? true;

  return (
    <Table.Tr
      ref={ref}
      style={{
        cursor: hasClickHandler ? 'pointer' : 'default',
        backgroundColor: isSelected ? 'var(--mantine-color-blue-light)' : undefined,
        opacity: isDeleted ? 0.6 : 1,
        textDecoration: isDeleted ? 'line-through' : 'none',
      }}
      onClick={() => onClick(item, index)}
    >
      {columns.map((col) => (
        <DataTableCell
          key={col.key}
          cellKey={col.key}
          isSelected={isSelected}
          scrollOnSelect={col.scrollOnSelect}
          content={
            col.render
              ? col.render(item)
              : String((item as Record<string, unknown>)[col.key] ?? '-')
          }
        />
      ))}
      {onReorder && (
        <Table.Td>
          <Group gap={2} wrap="nowrap">
            <ActionIcon
              size="xs"
              variant="subtle"
              disabled={!canReorder || isFirstInList}
              onClick={(e) => {
                e.stopPropagation();
                onReorder(getRowKey(item), 'up');
                onReorderPageChange?.('up', index);
              }}
            >
              <IconChevronUp size={14} />
            </ActionIcon>
            <ActionIcon
              size="xs"
              variant="subtle"
              disabled={!canReorder || isLastInList}
              onClick={(e) => {
                e.stopPropagation();
                onReorder(getRowKey(item), 'down');
                onReorderPageChange?.('down', index);
              }}
            >
              <IconChevronDown size={14} />
            </ActionIcon>
          </Group>
        </Table.Td>
      )}
      {showActions && (
        <Table.Td style={{ textAlign: 'center' }}>
          <Group gap="xs" justify="center" wrap="nowrap">
            {renderExtraCells?.(item)}
            {canDeleteItem &&
              (isDeleted ? (
                <>
                  {onUndelete && (
                    <Tooltip label="Restore">
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="green"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUndelete(item);
                        }}
                      >
                        <IconRestore size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  {onPermanentDelete && (
                    <Tooltip label="Remove permanently">
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPermanentDelete(item);
                        }}
                      >
                        <IconX size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </>
              ) : (
                onDelete && (
                  <Tooltip label="Delete">
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="red"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item);
                      }}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                )
              ))}
          </Group>
        </Table.Td>
      )}
    </Table.Tr>
  );
}

export const DataTableRow = memo(forwardRef(DataTableRowInner)) as <T>(
  props: DataTableRowProps<T> & { ref?: React.ForwardedRef<HTMLTableRowElement> }
) => React.ReactElement;
