import { Paper, Title, Text, Group, ActionIcon, Stack } from '@mantine/core';
import { IconPlus, IconX, IconFolder } from '@tabler/icons-react';
import { models } from '@wailsjs/go/models';

interface CollectionsPortalProps {
  collections: models.CollectionDetail[];
  onAdd?: () => void;
  onRemove?: (collID: number) => void;
}

export function CollectionsPortal({ collections, onAdd, onRemove }: CollectionsPortalProps) {
  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={4}>Collections</Title>
        {onAdd && (
          <ActionIcon variant="light" onClick={onAdd}>
            <IconPlus size={16} />
          </ActionIcon>
        )}
      </Group>

      {collections.length === 0 ? (
        <Text c="dimmed" size="sm" ta="center">
          Not in any collections
        </Text>
      ) : (
        <Stack gap="xs">
          {collections.map((coll) => (
            <Group key={coll.id} justify="space-between">
              <Group gap="xs">
                <IconFolder size={16} />
                <Text size="sm">{coll.collectionName}</Text>
              </Group>
              {onRemove && (
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  color="red"
                  onClick={() => onRemove(coll.collID)}
                >
                  <IconX size={14} />
                </ActionIcon>
              )}
            </Group>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
