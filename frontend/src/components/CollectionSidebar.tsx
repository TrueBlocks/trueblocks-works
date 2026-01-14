import { UnstyledButton, Group, Text, Stack } from '@mantine/core';
import { IconFolder, IconFolderFilled } from '@tabler/icons-react';
import { models } from '@models';

interface CollectionSidebarProps {
  collections: models.Collection[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

export function CollectionSidebar({ collections, selectedId, onSelect }: CollectionSidebarProps) {
  return (
    <Stack gap="xs">
      <UnstyledButton
        onClick={() => onSelect(null)}
        p="xs"
        style={{
          borderRadius: '6px',
          backgroundColor: selectedId === null ? 'var(--mantine-color-blue-0)' : 'transparent',
        }}
      >
        <Group gap="xs">
          <IconFolder size={18} />
          <Text size="sm" fw={selectedId === null ? 600 : 400}>
            All Collections
          </Text>
        </Group>
      </UnstyledButton>

      {collections.length > 0 && (
        <>
          <Text size="xs" c="dimmed" mt="sm" fw={600}>
            COLLECTIONS
          </Text>
          {collections.map((coll) => (
            <UnstyledButton
              key={coll.collID}
              onClick={() => onSelect(coll.collID)}
              p="xs"
              style={{
                borderRadius: '6px',
                backgroundColor:
                  selectedId === coll.collID ? 'var(--mantine-color-blue-0)' : 'transparent',
              }}
            >
              <Group gap="xs">
                {selectedId === coll.collID ? (
                  <IconFolderFilled size={18} />
                ) : (
                  <IconFolder size={18} />
                )}
                <Text size="sm" fw={selectedId === coll.collID ? 600 : 400}>
                  {coll.collectionName}
                </Text>
              </Group>
            </UnstyledButton>
          ))}
        </>
      )}
    </Stack>
  );
}
