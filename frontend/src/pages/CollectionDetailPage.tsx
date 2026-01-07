import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Stack,
  Grid,
  Loader,
  Flex,
  Text,
  Group,
  Paper,
  ActionIcon,
  NumberInput,
  Table,
} from '@mantine/core';
import { IconFolder, IconArrowLeft, IconX } from '@tabler/icons-react';
import { LogErr } from '@/utils';
import { useNotes } from '@/hooks';
import {
  GetCollection,
  GetCollectionWorks,
  RemoveWorkFromCollection,
  ReorderCollectionWorks,
  SetLastCollectionID,
  UpdateCollection,
} from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import { NotesPortal, DataTable, EditableField, Column, CollectionFieldSelect } from '@/components';

export function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<models.Collection | null>(null);
  const [works, setWorks] = useState<models.CollectionWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingWorkId, setEditingWorkId] = useState<number | null>(null);
  const [editingPosition, setEditingPosition] = useState<number | string>(0);

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

  const handlePositionChange = useCallback(
    async (workId: number, newPosition: number) => {
      if (!collId) return;

      const sortedWorks = [...works].sort((a, b) => a.position - b.position);
      const currentIndex = sortedWorks.findIndex((w) => w.workID === workId);
      if (currentIndex === -1) return;

      const clampedPosition = Math.max(0, Math.min(newPosition, sortedWorks.length - 1));
      if (clampedPosition === sortedWorks[currentIndex].position) {
        setEditingWorkId(null);
        return;
      }

      const [movedWork] = sortedWorks.splice(currentIndex, 1);
      sortedWorks.splice(clampedPosition, 0, movedWork);

      const reorderedIds = sortedWorks.map((w) => w.workID);
      const updatedWorks = sortedWorks.map((w, i) => ({ ...w, position: i }));
      setWorks(updatedWorks);
      setEditingWorkId(null);

      try {
        await ReorderCollectionWorks(collId, reorderedIds);
      } catch (err) {
        LogErr('Failed to reorder works:', err);
        loadData();
      }
    },
    [collId, works, loadData]
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

  const startEditing = useCallback((work: models.CollectionWork) => {
    setEditingWorkId(work.workID);
    setEditingPosition(work.position);
  }, []);

  const commitPosition = useCallback(
    (workId: number) => {
      const pos =
        typeof editingPosition === 'string' ? parseInt(editingPosition, 10) : editingPosition;
      if (!isNaN(pos)) {
        handlePositionChange(workId, pos);
      } else {
        setEditingWorkId(null);
      }
    },
    [editingPosition, handlePositionChange]
  );

  const columns: Column<models.CollectionWork>[] = useMemo(
    () => [
      {
        key: 'position',
        label: 'Pos',
        width: '70px',
        render: (work) =>
          editingWorkId === work.workID ? (
            <div
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <NumberInput
                size="xs"
                w={50}
                min={0}
                max={works.length - 1}
                value={editingPosition}
                onChange={(val) => setEditingPosition(val)}
                onBlur={() => commitPosition(work.workID)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitPosition(work.workID);
                  } else if (e.key === 'Escape') {
                    setEditingWorkId(null);
                  }
                }}
                autoFocus
              />
            </div>
          ) : (
            <Text
              size="sm"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                startEditing(work);
              }}
            >
              {work.position}
            </Text>
          ),
      },
      {
        key: 'title',
        label: 'Title',
        render: (work) => (
          <Text size="sm" truncate>
            {work.title}
          </Text>
        ),
      },
      {
        key: 'type',
        label: 'Type',
        width: '100px',
        render: (work) => <Text size="sm">{work.type || '-'}</Text>,
      },
      {
        key: 'year',
        label: 'Year',
        width: '70px',
        render: (work) => <Text size="sm">{work.year || '-'}</Text>,
      },
      {
        key: 'nWords',
        label: 'Words',
        width: '80px',
        render: (work) => <Text size="sm">{work.nWords ? work.nWords.toLocaleString() : '-'}</Text>,
      },
    ],
    [editingWorkId, editingPosition, works.length, startEditing, commitPosition]
  );

  const filterFn = useCallback((work: models.CollectionWork, search: string) => {
    const s = search.toLowerCase();
    return (
      work.title.toLowerCase().includes(s) ||
      (work.type?.toLowerCase().includes(s) ?? false) ||
      (work.year?.toLowerCase().includes(s) ?? false)
    );
  }, []);

  const valueGetter = useCallback((item: models.CollectionWork, column: string) => {
    switch (column) {
      case 'position':
        return item.position;
      case 'nWords':
        return item.nWords ?? 0;
      default:
        return (item as unknown as Record<string, unknown>)[column];
    }
  }, []);

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
          <ActionIcon variant="subtle" size="lg" onClick={() => navigate('/collections')}>
            <IconArrowLeft size={20} />
          </ActionIcon>
          <IconFolder size={32} />
          <div style={{ flex: 1 }}>
            <EditableField value={collection.collectionName} onChange={handleNameChange} />
            <Group gap="xs" mt={4}>
              <CollectionFieldSelect
                collection={collection}
                field="type"
                width={100}
                onUpdate={(updated) => setCollection(updated)}
              />
              <Text size="sm" c="dimmed">
                {works.length} work{works.length !== 1 ? 's' : ''}
              </Text>
            </Group>
          </div>
        </Group>
      </Paper>

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <DataTable
            title="Works in Collection"
            data={works}
            columns={columns}
            getRowKey={(work) => work.workID}
            onRowClick={(work) => navigate(`/works/${work.workID}`)}
            filterFn={filterFn}
            viewName="collectionDetailWorks"
            initialSort={{
              primary: { column: 'position', direction: 'asc' },
              secondary: { column: '', direction: '' },
            }}
            valueGetter={valueGetter}
            extraColumns={<Table.Th style={{ width: '50px' }} />}
            renderExtraCells={(work) => (
              <Table.Td>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveWork(work.workID);
                  }}
                >
                  <IconX size={14} />
                </ActionIcon>
              </Table.Td>
            )}
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
