import { Paper, Title, Text, Group, ActionIcon, Stack } from '@mantine/core';
import { IconPlus, IconX, IconFolder, IconExternalLink } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { models } from '@models';

interface CollectionsPortalProps {
  collections: models.CollectionDetail[];
  onAdd?: () => void;
  onRemove?: (collID: number) => void;
  onCollectionClick?: (collID: number) => void;
}

export function CollectionsPortal({
  collections,
  onAdd,
  onRemove,
  onCollectionClick,
}: CollectionsPortalProps) {
  const navigate = useNavigate();

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
                <Text
                  size="sm"
                  style={{ cursor: 'pointer' }}
                  onClick={() =>
                    onCollectionClick
                      ? onCollectionClick(coll.collID)
                      : navigate(`/collections/${coll.collID}`)
                  }
                >
                  {coll.collectionName}
                </Text>
              </Group>
              {onRemove && (
                <Group gap={4}>
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    color="red"
                    onClick={() => onRemove(coll.collID)}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    onClick={() => navigate(`/collections/${coll.collID}`)}
                  >
                    <IconExternalLink size={14} />
                  </ActionIcon>
                </Group>
              )}
            </Group>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
