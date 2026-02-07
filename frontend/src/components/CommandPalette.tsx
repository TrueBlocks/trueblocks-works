import { useEffect, useRef } from 'react';
import { Modal, TextInput, Stack, Group, Text, UnstyledButton, Box } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { Command } from '@/commands';

interface CommandPaletteProps {
  opened: boolean;
  onClose: () => void;
  commands: Command[];
  query: string;
  onQueryChange: (q: string) => void;
  selectedIndex: number;
  onSelectedIndexChange: (i: number) => void;
  onSelectCommand: (cmd: Command) => void;
  markedCount: number;
}

export function CommandPalette({
  opened,
  onClose,
  commands,
  query,
  onQueryChange,
  selectedIndex,
  onSelectedIndexChange,
  onSelectCommand,
  markedCount,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (opened && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [opened]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && commands.length > 0) {
      const items = listRef.current.querySelectorAll('[data-command-item]');
      const selectedItem = items[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, commands.length]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      onSelectedIndexChange((selectedIndex + 1) % commands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onSelectedIndexChange((selectedIndex - 1 + commands.length) % commands.length);
    } else if (e.key === 'Enter' && commands.length > 0) {
      e.preventDefault();
      onSelectCommand(commands[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      size="md"
      padding="xs"
      radius="md"
      centered
      styles={{
        body: { padding: 0 },
        content: { overflow: 'hidden' },
      }}
    >
      <Stack gap={0}>
        <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
          <TextInput
            ref={inputRef}
            placeholder="Type a command..."
            value={query}
            onChange={(e) => onQueryChange(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            leftSection={<IconSearch size={16} />}
            rightSection={
              markedCount > 0 ? (
                <Text size="xs" c="dimmed">
                  {markedCount} marked
                </Text>
              ) : null
            }
            rightSectionWidth={80}
            variant="unstyled"
            styles={{
              input: { fontSize: 14 },
            }}
          />
        </Box>

        <Box ref={listRef} mah={300} style={{ overflowY: 'auto' }}>
          {commands.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              No commands found
            </Text>
          ) : (
            commands.map((cmd, index) => {
              const Icon = cmd.icon;
              const isSelected = index === selectedIndex;

              return (
                <UnstyledButton
                  key={cmd.id}
                  data-command-item
                  onClick={() => onSelectCommand(cmd)}
                  onMouseEnter={() => onSelectedIndexChange(index)}
                  w="100%"
                  p="xs"
                  style={{
                    backgroundColor: isSelected ? 'var(--mantine-color-blue-light)' : 'transparent',
                  }}
                >
                  <Group gap="sm" wrap="nowrap">
                    {Icon && <Icon size={18} stroke={1.5} />}
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={500} truncate>
                        {cmd.label}
                      </Text>
                      {cmd.description && (
                        <Text size="xs" c="dimmed" truncate>
                          {cmd.description}
                        </Text>
                      )}
                    </Box>
                  </Group>
                </UnstyledButton>
              );
            })
          )}
        </Box>
      </Stack>
    </Modal>
  );
}
