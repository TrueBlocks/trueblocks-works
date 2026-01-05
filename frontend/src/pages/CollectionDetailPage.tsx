import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Stack, Grid, Loader, Flex, Text, Group, Badge, Paper } from '@mantine/core';
import { IconFolder } from '@tabler/icons-react';
import { LogErr } from '@/utils';
import { useNotes } from '@/hooks';
import {
  GetCollection,
  GetCollectionWorks,
  RemoveWorkFromCollection,
  SetLastCollectionID,
  UpdateCollection,
} from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import { NotesPortal, WorksPortal, EditableField } from '@/components';

export function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<models.Collection | null>(null);
  const [works, setWorks] = useState<models.Work[]>([]);
  const [loading, setLoading] = useState(true);

  const collId = id ? parseInt(id, 10) : null;
  const {
    notes,
    handleAdd: handleAddNote,
    handleUpdate: handleUpdateNote,
    handleDelete: handleDeleteNote,
  } = useNotes('collection', collId);

  const loadData = useCallback(async () => {
    if (!collId) return;
    setLoading(true);
    try {
      const [collData, worksData] = await Promise.all([
        GetCollection(collId),
        GetCollectionWorks(collId),
      ]);
      setCollection(collData);
      setWorks(worksData || []);
      SetLastCollectionID(collId);
    } catch (err) {
      LogErr('Failed to load collection data:', err);
    } finally {
      setLoading(false);
    }
  }, [collId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRemoveWork = useCallback(
    async (workId: number) => {
      if (!collId) return;
      await RemoveWorkFromCollection(collId, workId);
      setWorks((prev) => prev.filter((w) => w.workID !== workId));
    },
    [collId]
  );

  const handleNameChange = useCallback(
    async (newName: string) => {
      if (!collection) return;
      const updated = { ...collection, collectionName: newName } as models.Collection;
      setCollection(updated);
      await UpdateCollection(updated);
    },
    [collection]
  );

  if (loading) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  if (!collection) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Text c="dimmed">Collection not found</Text>
      </Flex>
    );
  }

  return (
    <Stack gap="lg">
      <Paper p="md" withBorder>
        <Group gap="md">
          <IconFolder size={32} />
          <div style={{ flex: 1 }}>
            <EditableField value={collection.collectionName} onChange={handleNameChange} />
            <Group gap="xs" mt={4}>
              {collection.type && (
                <Badge color="blue" variant="light">
                  {collection.type}
                </Badge>
              )}
              {collection.isStatus && (
                <Badge color="green" variant="light">
                  Status Collection
                </Badge>
              )}
              <Text size="sm" c="dimmed">
                {works.length} work{works.length !== 1 ? 's' : ''}
              </Text>
            </Group>
          </div>
        </Group>
      </Paper>

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <WorksPortal
            title="Works in Collection"
            works={works}
            onRowClick={(work) => navigate(`/works/${work.workID}`)}
            onRemove={handleRemoveWork}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <NotesPortal
            notes={notes}
            onAdd={handleAddNote}
            onUpdate={handleUpdateNote}
            onDelete={handleDeleteNote}
          />
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
