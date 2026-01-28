import { useState } from 'react';
import { Popover, Paper, Stack, Text, TextInput, UnstyledButton, Group } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

export interface SelectablePopoverProps {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  children: React.ReactNode;
}

export function SelectablePopover({
  options,
  value,
  onChange,
  label = 'Select',
  children,
}: SelectablePopoverProps) {
  const [opened, setOpened] = useState(false);
  const [newValue, setNewValue] = useState('');

  const handleSelect = (option: string) => {
    onChange(option);
    setOpened(false);
  };

  const handleAddNew = () => {
    if (newValue.trim()) {
      onChange(newValue.trim());
      setNewValue('');
      setOpened(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddNew();
    }
    if (e.key === 'Escape') {
      setNewValue('');
      setOpened(false);
    }
  };

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" shadow="md" withinPortal>
      <Popover.Target>
        <div style={{ cursor: 'pointer' }} onClick={() => setOpened((o) => !o)}>
          {children}
        </div>
      </Popover.Target>
      <Popover.Dropdown p={0} onClick={(e) => e.stopPropagation()}>
        <Paper p="sm" style={{ minWidth: 180 }}>
          <Text size="sm" fw={500} mb="xs">
            {label}
          </Text>
          <Stack gap={4}>
            {options.map((option) => (
              <UnstyledButton
                key={option || '__empty__'}
                onClick={() => handleSelect(option)}
                p="xs"
                style={{
                  borderRadius: 'var(--mantine-radius-sm)',
                  backgroundColor: option === value ? 'var(--mantine-color-blue-1)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (option !== value) {
                    e.currentTarget.style.backgroundColor = 'var(--mantine-color-gray-1)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    option === value ? 'var(--mantine-color-blue-1)' : 'transparent';
                }}
              >
                <Text size="sm" {...(option === '' ? { c: 'dimmed', fs: 'italic' } : {})}>
                  {option || '(Empty)'}
                </Text>
              </UnstyledButton>
            ))}
          </Stack>
          <Group gap="xs" mt="sm">
            <TextInput
              placeholder="Add new..."
              size="xs"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ flex: 1 }}
            />
            <UnstyledButton
              onClick={handleAddNew}
              p={4}
              style={{
                borderRadius: 'var(--mantine-radius-sm)',
                color: newValue.trim()
                  ? 'var(--mantine-color-blue-6)'
                  : 'var(--mantine-color-gray-5)',
              }}
            >
              <IconPlus size={16} />
            </UnstyledButton>
          </Group>
        </Paper>
      </Popover.Dropdown>
    </Popover>
  );
}
