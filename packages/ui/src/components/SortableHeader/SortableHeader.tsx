import { ReactNode, CSSProperties } from 'react';
import { Table, Group, Text } from '@mantine/core';
import { IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import type { SortDirection } from '../../hooks/useTableState';

export interface SortableHeaderProps {
  label: string;
  column: string;
  level: 1 | 2 | 3 | 4 | null;
  direction: SortDirection;
  onClick: (column: string, metaKey: boolean) => void;
  style?: CSSProperties;
  filterElement?: ReactNode;
}

export function SortableHeader({
  label,
  column,
  level,
  direction,
  onClick,
  style,
  filterElement,
}: SortableHeaderProps) {
  const handleClick = (e: React.MouseEvent) => {
    onClick(column, e.metaKey || e.ctrlKey);
  };

  return (
    <Table.Th style={{ ...style, cursor: 'pointer', userSelect: 'none' }} onClick={handleClick}>
      <Group gap={4} wrap="nowrap">
        <Text size="sm" fw={500}>
          {label}
        </Text>
        {level !== null && direction && (
          <Group gap={2}>
            {direction === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />}
            {level > 1 && (
              <Text size="xs" c="dimmed">
                {level}
              </Text>
            )}
          </Group>
        )}
        {filterElement}
      </Group>
    </Table.Th>
  );
}
