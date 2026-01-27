import { useState } from 'react';
import {
  Popover,
  ActionIcon,
  Checkbox,
  Paper,
  Group,
  Text,
  CloseButton,
  Anchor,
  SimpleGrid,
} from '@mantine/core';
import { IconFilter, IconFilterFilled } from '@tabler/icons-react';

export interface ColumnFilterPopoverProps {
  options: readonly string[];
  selected: Set<string>;
  onChange: (value: string) => void;
  onSelectAll?: () => void;
  onSelectNone?: () => void;
  onSelectOnly?: (value: string) => void;
  onSelectWorks?: () => void;
  onSelectIdeas?: () => void;
  label?: string;
}

export function ColumnFilterPopover({
  options,
  selected,
  onChange,
  onSelectAll,
  onSelectNone,
  onSelectOnly,
  onSelectWorks,
  onSelectIdeas,
  label = 'Filter',
}: ColumnFilterPopoverProps) {
  const [opened, setOpened] = useState(false);
  const hasActiveFilter = selected.size !== options.length;

  const handleSelectAll = () => {
    if (onSelectAll) {
      onSelectAll();
    } else {
      options.forEach((opt) => {
        if (!selected.has(opt)) onChange(opt);
      });
    }
  };

  const handleSelectNone = () => {
    if (onSelectNone) {
      onSelectNone();
    } else {
      options.forEach((opt) => {
        if (selected.has(opt)) onChange(opt);
      });
    }
  };

  const handleSelectOnly = (value: string) => {
    if (onSelectOnly) {
      onSelectOnly(value);
    } else {
      options.forEach((opt) => {
        if (opt === value) {
          if (!selected.has(opt)) onChange(opt);
        } else {
          if (selected.has(opt)) onChange(opt);
        }
      });
    }
  };

  const handleCheckboxClick = (option: string, e: React.MouseEvent) => {
    if (e.metaKey) {
      handleSelectOnly(option);
    } else {
      onChange(option);
    }
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
        <Paper p="sm" style={{ minWidth: 200 }}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>
              {label}
            </Text>
            <Group gap="xs">
              {onSelectWorks && (
                <Anchor size="xs" onClick={onSelectWorks}>
                  Works
                </Anchor>
              )}
              {onSelectIdeas && (
                <Anchor size="xs" onClick={onSelectIdeas}>
                  Ideas
                </Anchor>
              )}
              {(onSelectWorks || onSelectIdeas) && (
                <Text size="xs" c="dimmed">
                  |
                </Text>
              )}
              <Anchor size="xs" onClick={handleSelectAll}>
                All
              </Anchor>
              <Anchor size="xs" onClick={handleSelectNone}>
                None
              </Anchor>
              <CloseButton size="sm" onClick={() => setOpened(false)} />
            </Group>
          </Group>
          <SimpleGrid cols={3} spacing="xs" verticalSpacing="xs">
            {options.map((option) => (
              <Checkbox
                key={option || '__empty__'}
                label={option || '(Empty)'}
                checked={selected.has(option)}
                onChange={() => {}}
                onClick={(e) => handleCheckboxClick(option, e)}
                size="sm"
                {...(option === ''
                  ? {
                      styles: {
                        label: { fontStyle: 'italic', color: 'var(--mantine-color-dimmed)' },
                      },
                    }
                  : {})}
              />
            ))}
          </SimpleGrid>
        </Paper>
      </Popover.Dropdown>
    </Popover>
  );
}
