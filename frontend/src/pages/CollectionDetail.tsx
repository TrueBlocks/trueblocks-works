import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stack, Paper, Group, ActionIcon, Flex, Loader, Text, Grid, Table } from '@mantine/core';
import { IconFolder, IconArrowLeft, IconPlus, IconX } from '@tabler/icons-react';
import { Log, LogErr } from '@/utils';
import {
  GetCollection,
  GetCollectionWorks,
  UpdateCollection,
  RemoveWorkFromCollection,
} from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import {
  DataTable,
  Column,
  StatusBadge,
  TypeBadge,
  QualityBadge,
  EditableField,
  WorkPickerModal,
  NotesPortal,
  CollectionFieldSelect,
} from '@/components';
import { useNotes } from '@/hooks';

interface CollectionDetailProps {
  collectionId: number;
}

export function CollectionDetail({ collectionId }: CollectionDetailProps) {
  const navigate = useNavigate();
  const [collection, setCollection] = useState<models.CollectionView | null>(null);
  const [works, setWorks] = useState<models.CollectionWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [workPickerOpen, setWorkPickerOpen] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    years: [] as string[],
    types: [] as string[],
    statuses: [] as string[],
    qualities: [] as string[],
  });
  const hasInitialized = useRef(false);

  const {
    notes,
    handleAdd: handleAddNote,
    handleUpdate: handleUpdateNote,
    handleDelete: handleDeleteNote,
  } = useNotes('collection', collectionId);

  const loadData = useCallback(() => {
    if (!collectionId) return;

    Promise.all([GetCollection(collectionId), GetCollectionWorks(collectionId)])
      .then(([coll, worksData]) => {
        setCollection(coll as models.CollectionView);
        const data = worksData || [];
        setWorks(data);

        const years = [...new Set(data.map((w) => w.year).filter(Boolean))].sort() as string[];
        const types = [...new Set(data.map((w) => w.type).filter(Boolean))] as string[];
        const statuses = [...new Set(data.map((w) => w.status).filter(Boolean))] as string[];
        const qualities = [...new Set(data.map((w) => w.quality).filter(Boolean))] as string[];

        setFilterOptions({ years, types, statuses, qualities });
      })
      .catch((err) => LogErr(`Failed to load collection ${collectionId}:`, err))
      .finally(() => setLoading(false));
  }, [collectionId]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    loadData();
  }, [loadData]);

  const handleNameChange = useCallback(
    (newName: string) => {
      if (!collection) return;
      const updated = { ...collection, collectionName: newName };
      UpdateCollection(updated)
        .then(() => {
          setCollection(updated);
          Log(`Collection renamed to: ${newName}`);
        })
        .catch((err) => LogErr('Failed to update collection:', err));
    },
    [collection]
  );

  const handleRemoveWork = useCallback(
    (workID: number) => {
      if (!collectionId) return;
      RemoveWorkFromCollection(collectionId, workID)
        .then(() => {
          Log(`Removed work ${workID} from collection`);
          loadData();
        })
        .catch((err) => LogErr('Failed to remove work:', err));
    },
    [collectionId, loadData]
  );

  const columns: Column<models.CollectionWork>[] = useMemo(
    () => [
      { key: 'workID', label: 'ID', width: '8%', render: (work) => work.workID },
      { key: 'title', label: 'Title', width: '30%', render: (work) => work.title },
      {
        key: 'year',
        label: 'Year',
        width: '10%',
        render: (work) => <Text size="sm">{work.year || '-'}</Text>,
        filterOptions: filterOptions.years,
      },
      {
        key: 'type',
        label: 'Type',
        width: '15%',
        render: (work) => <TypeBadge value={work.type} />,
        filterOptions: filterOptions.types,
      },
      {
        key: 'status',
        label: 'Status',
        width: '15%',
        render: (work) => <StatusBadge status={work.status} />,
        filterOptions: filterOptions.statuses,
      },
      {
        key: 'quality',
        label: 'Quality',
        width: '12%',
        render: (work) => <QualityBadge quality={work.quality} />,
        filterOptions: filterOptions.qualities,
      },
      {
        key: 'modifiedAt',
        label: 'Last Modified',
        width: '10%',
        render: (work) =>
          work.modifiedAt ? new Date(work.modifiedAt + 'Z').toLocaleDateString() : '-',
      },
    ],
    [filterOptions]
  );

  const searchFn = useCallback((work: models.CollectionWork, search: string) => {
    return work.title.toLowerCase().includes(search.toLowerCase());
  }, []);

  const valueGetter = useCallback((item: models.CollectionWork, column: string) => {
    switch (column) {
      case 'workID':
        return item.workID;
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
                onUpdate={(updated) => setCollection(updated as models.CollectionView)}
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
          <DataTable<models.CollectionWork>
            tableName={`collection-${collectionId}`}
            title="Works in Collection"
            data={works}
            columns={columns}
            getRowKey={(work) => work.workID}
            onRowClick={(work) => navigate(`/works/${work.workID}`)}
            searchFn={searchFn}
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
            headerActions={
              <ActionIcon variant="light" onClick={() => setWorkPickerOpen(true)}>
                <IconPlus size={16} />
              </ActionIcon>
            }
          />
          <WorkPickerModal
            opened={workPickerOpen}
            onClose={() => setWorkPickerOpen(false)}
            collectionID={collectionId}
            onUpdate={loadData}
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
