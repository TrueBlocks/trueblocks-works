import { Group, Kbd, Text } from '@mantine/core';

export interface KeyboardHint {
  keys: string[];
  label: string;
}

export interface KeyboardHintsProps {
  hints: KeyboardHint[];
}

export function KeyboardHints({ hints }: KeyboardHintsProps) {
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
