import { useState } from 'react';
import {
  Popover,
  ActionIcon,
  Checkbox,
  Paper,
  Group,
  Text,
  CloseButton,
  Stack,
} from '@mantine/core';
import { IconFilter, IconFilterFilled } from '@tabler/icons-react';

interface ColumnFilterPopoverProps {
  options: readonly string[];
  selected: Set<string>;
  onChange: (value: string) => void;
  label?: string;
}

export function ColumnFilterPopover({
  options,
  selected,
  onChange,
  label = 'Filter',
}: ColumnFilterPopoverProps) {
  const [opened, setOpened] = useState(false);
  const hasActiveFilter = selected.size !== options.length;

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" shadow="md" withinPortal>
      <Popover.Target>
        <ActionIcon
          size="xs"
          variant="subtle"
          color={hasActiveFilter ? 'blue' : 'gray'}
          onClick={(e) => {
            e.stopPropagation();
            setOpened((o) => !o);
          }}
        >
          {hasActiveFilter ? <IconFilterFilled size={14} /> : <IconFilter size={14} />}
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown p={0} onClick={(e) => e.stopPropagation()}>
        <Paper p="sm" style={{ minWidth: 150 }}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>
              {label}
            </Text>
            <CloseButton size="sm" onClick={() => setOpened(false)} />
          </Group>
          <Stack gap="xs">
            {options.map((option) => (
              <Checkbox
                key={option}
                label={option}
                checked={selected.has(option)}
                onChange={() => onChange(option)}
                size="sm"
              />
            ))}
          </Stack>
        </Paper>
      </Popover.Dropdown>
    </Popover>
  );
}
