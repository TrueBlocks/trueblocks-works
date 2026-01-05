import { useState } from 'react';
import {
  Popover,
  ActionIcon,
  Paper,
  Group,
  Text,
  CloseButton,
  Anchor,
  NumberInput,
  Stack,
} from '@mantine/core';
import { IconFilter, IconFilterFilled } from '@tabler/icons-react';

interface NumericFilterPopoverProps {
  min: number | undefined;
  max: number | undefined;
  onChange: (min: number | undefined, max: number | undefined) => void;
  label?: string;
}

export function NumericFilterPopover({
  min,
  max,
  onChange,
  label = 'Filter',
}: NumericFilterPopoverProps) {
  const [opened, setOpened] = useState(false);

  const hasActiveFilter = min !== undefined || max !== undefined;

  const handleClear = () => {
    onChange(undefined, undefined);
  };

  const handleMinChange = (value: number | string) => {
    const numValue = typeof value === 'string' ? undefined : value;
    onChange(numValue, max);
  };

  const handleMaxChange = (value: number | string) => {
    const numValue = typeof value === 'string' ? undefined : value;
    onChange(min, numValue);
  };

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom" shadow="md" withinPortal>
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
        <Paper p="sm" style={{ minWidth: 180 }}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>
              {label}
            </Text>
            <Group gap="xs">
              <Anchor size="xs" onClick={handleClear}>
                Clear
              </Anchor>
              <CloseButton size="sm" onClick={() => setOpened(false)} />
            </Group>
          </Group>
          <Stack gap="xs">
            <NumberInput
              size="xs"
              label="Min"
              placeholder="No minimum"
              value={min ?? ''}
              onChange={handleMinChange}
              min={0}
            />
            <NumberInput
              size="xs"
              label="Max"
              placeholder="No maximum"
              value={max ?? ''}
              onChange={handleMaxChange}
              min={0}
            />
          </Stack>
        </Paper>
      </Popover.Dropdown>
    </Popover>
  );
}
