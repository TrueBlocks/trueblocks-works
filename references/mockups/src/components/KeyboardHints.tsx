import { Group, Text, Kbd, Box } from '@mantine/core';

/**
 * Displays keyboard shortcut hints in the footer of the application
 */
export function KeyboardHints() {
  return (
    <Box 
      style={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 220, 
        right: 0, 
        borderTop: '1px solid #dee2e6',
        backgroundColor: '#f8f9fa',
        zIndex: 100,
      }}
    >
      <Group gap="lg" p="xs" justify="center">
        <Group gap={4}>
          <Kbd size="xs">⌘</Kbd><Kbd size="xs">1-4</Kbd>
          <Text size="xs" c="dimmed">Pages</Text>
        </Group>
        <Group gap={4}>
          <Kbd size="xs">↑</Kbd><Kbd size="xs">↓</Kbd>
          <Text size="xs" c="dimmed">Records</Text>
        </Group>
        <Group gap={4}>
          <Kbd size="xs">⌘</Kbd><Kbd size="xs">⇧</Kbd><Kbd size="xs">↑↓</Kbd>
          <Text size="xs" c="dimmed">First/Last</Text>
        </Group>
        <Group gap={4}>
          <Kbd size="xs">⌘</Kbd><Kbd size="xs">V</Kbd>
          <Text size="xs" c="dimmed">Toggle View</Text>
        </Group>
        <Group gap={4}>
          <Kbd size="xs">⌘</Kbd><Kbd size="xs">N</Kbd>
          <Text size="xs" c="dimmed">New</Text>
        </Group>
        <Group gap={4}>
          <Kbd size="xs">⌘</Kbd><Kbd size="xs">F</Kbd>
          <Text size="xs" c="dimmed">Find</Text>
        </Group>
        <Group gap={4}>
          <Kbd size="xs">Esc</Kbd>
          <Text size="xs" c="dimmed">Cancel</Text>
        </Group>
      </Group>
    </Box>
  );
}
