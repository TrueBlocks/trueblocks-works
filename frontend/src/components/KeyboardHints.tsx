import { Group, Kbd, Text } from '@mantine/core';

const hints = [
  { keys: ['⌘', 'K'], label: 'Search' },
  { keys: ['⌘', '⇧', 'B'], label: 'Backup' },
  { keys: ['⌘', '1'], label: 'Works' },
  { keys: ['⌘', '2'], label: 'Organizations' },
  { keys: ['⌘', '3'], label: 'Submissions' },
  { keys: ['⌘', '4'], label: 'Collections' },
];

export function KeyboardHints() {
  return (
    <Group gap="lg" mt="auto" pt="md">
      {hints.map((hint) => (
        <Group key={hint.label} gap={4}>
          {hint.keys.map((key, i) => (
            <Kbd key={i} size="xs">
              {key}
            </Kbd>
          ))}
          <Text size="xs" c="dimmed">
            {hint.label}
          </Text>
        </Group>
      ))}
    </Group>
  );
}
