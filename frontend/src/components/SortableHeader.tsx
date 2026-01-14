import { Group, Text, Stack } from '@mantine/core';
import { IconChevronUp, IconChevronDown } from '@tabler/icons-react';
import type { SortDirection } from './DataTable';

interface SortableHeaderProps {
  label: string;
  column: string;
  level: 1 | 2 | 3 | 4 | null;
  direction: SortDirection;
  onClick: (column: string, metaKey: boolean) => void;
  style?: React.CSSProperties;
  filterElement?: React.ReactNode;
}

function SortIcon({ direction }: { direction: SortDirection }) {
  if (direction === 'asc') {
    return <IconChevronUp size={14} stroke={2} />;
  }
  if (direction === 'desc') {
    return <IconChevronDown size={14} stroke={2} />;
  }
  return (
    <Stack gap={0} style={{ opacity: 0.3 }}>
      <IconChevronUp size={10} stroke={2} style={{ marginBottom: -4 }} />
      <IconChevronDown size={10} stroke={2} />
    </Stack>
  );
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
  return (
    <th
      style={{ ...style, cursor: 'pointer', userSelect: 'none' }}
      onClick={(e) => onClick(column, e.metaKey)}
    >
      <Group gap={4} wrap="nowrap">
        <Text fw={500} size="sm">
          {label}
        </Text>
        <Group gap={2} wrap="nowrap">
          <SortIcon direction={direction} />
          {level && (
            <Text size="xs" c="dimmed" fw={600}>
              {level}
            </Text>
          )}
        </Group>
        {filterElement}
      </Group>
    </th>
  );
}
