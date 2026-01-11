import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Stack, Paper, Group, ActionIcon, Flex, Loader, Text, Grid, Table } from '@mantine/core';
import {
  IconFolder,
  IconArrowLeft,
  IconPlus,
  IconX,
  IconTrash,
  IconRestore,
} from '@tabler/icons-react';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { LogErr } from '@/utils';
import {
  GetCollection,
  GetCollectionWorks,
  UpdateCollection,
  RemoveWorkFromCollection,
  DeleteCollection,
  UndeleteCollection,
  GetCollectionDeleteConfirmation,
  DeleteCollectionPermanent,
  SetLastWorkID,
  GetAppState,
} from '@wailsjs/go/main/App';
import { models, db } from '@wailsjs/go/models';
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
  ConfirmDeleteModal,
} from '@/components';
import { useNotes } from '@/hooks';

interface CollectionDetailProps {
  collectionId: number;
  filteredCollections: models.CollectionView[];
}

export function CollectionDetail({
  collectionId,
  filteredCollections: _filteredCollections,
}: CollectionDetailProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [collection, setCollection] = useState<models.CollectionView | null>(null);
  const [works, setWorks] = useState<models.CollectionWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialSelectID, setInitialSelectID] = useState<number | undefined>(undefined);
  const [workPickerOpen, setWorkPickerOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<db.DeleteConfirmation | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
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
    handleUndelete: handleUndeleteNote,
    handlePermanentDelete: handlePermanentDeleteNote,
  } = useNotes('collection', collectionId);

  const handleReturnToList = useCallback(() => {
    // Check if we came from the collections list
    const fromList = (location.state as { fromList?: boolean } | null)?.fromList;
    if (fromList) {
      navigate('/collections');
    } else {
      // If navigated directly (e.g., via URL or Cmd+2), just go to list
      navigate('/collections');
    }
  }, [navigate, location.state]);

  useHotkeys([
    ['mod+shift+ArrowLeft', handleReturnToList],
    ['mod+shift+ArrowUp', handleReturnToList],
  ]);

  const loadData = useCallback(async () => {
    if (!collectionId) return;

    try {
      const [coll, worksData] = await Promise.all([
        GetCollection(collectionId),
        GetCollectionWorks(collectionId),
      ]);

      setCollection(coll as models.CollectionView);
      const data = worksData || [];
      setWorks(data);

      const years = [...new Set(data.map((w) => w.year).filter(Boolean))].sort() as string[];
      const types = [...new Set(data.map((w) => w.type).filter(Boolean))] as string[];
      const statuses = [...new Set(data.map((w) => w.status).filter(Boolean))] as string[];
      const qualities = [...new Set(data.map((w) => w.quality).filter(Boolean))] as string[];

      setFilterOptions({ years, types, statuses, qualities });

      // Set selection if coming from work detail
      const state = location.state as { selectID?: number } | null;
      if (state?.selectID) {
        setInitialSelectID(state.selectID);
        await SetLastWorkID(state.selectID);
        window.history.replaceState({}, document.title);
      } else {
        setInitialSelectID(undefined);
      }
    } catch (err) {
      LogErr(`Failed to load collection ${collectionId}:`, err);
    } finally {
      setLoading(false);
    }
  }, [collectionId, location.state]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    loadData();
  }, [loadData]);

  // Reload on Cmd+R
  useEffect(() => {
    function handleReload() {
      loadData();
    }
    window.addEventListener('reloadCurrentView', handleReload);
    return () => window.removeEventListener('reloadCurrentView', handleReload);
  }, [loadData]);

  // Reload when works are deleted/restored
  useEffect(() => {
    function handleShowDeletedChanged() {
      loadData();
    }
    window.addEventListener('showDeletedChanged', handleShowDeletedChanged);
    return () => window.removeEventListener('showDeletedChanged', handleShowDeletedChanged);
  }, [loadData]);

  const handleDelete = useCallback(async () => {
    if (!collection) return;
    try {
      await DeleteCollection(collection.collID);
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
      loadData();
    } catch (err) {
      LogErr('Failed to delete collection:', err);
      notifications.show({
        message: 'Delete failed',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, [collection, loadData]);

  const handleUndelete = useCallback(async () => {
    if (!collection) return;
    try {
      await UndeleteCollection(collection.collID);
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
      loadData();
    } catch (err) {
      LogErr('Failed to restore collection:', err);
      notifications.show({
        message: 'Restore failed',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, [collection, loadData]);

  const handlePermanentDeleteClick = useCallback(async () => {
    if (!collection) return;
    try {
      const conf = await GetCollectionDeleteConfirmation(collection.collID);
      setDeleteConfirmation(conf);
      setDeleteModalOpen(true);
    } catch (err) {
      LogErr('Failed to get delete confirmation:', err);
      notifications.show({
        message: 'Failed to prepare delete',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, [collection]);

  const handlePermanentDelete = useCallback(async () => {
    if (!collection) return;
    setDeleteLoading(true);
    try {
      await DeleteCollectionPermanent(collection.collID);
      setDeleteModalOpen(false);
      notifications.show({
        message: 'Collection permanently deleted',
        color: 'green',
        autoClose: 3000,
      });
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
      navigate('/collections');
    } catch (err) {
      LogErr('Failed to permanently delete collection:', err);
      notifications.show({
        message: 'Permanent delete failed',
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setDeleteLoading(false);
    }
  }, [collection, navigate]);

  const handleNameChange = useCallback(
    (newName: string) => {
      if (!collection) return;
      const updated = { ...collection, collectionName: newName };
      UpdateCollection(updated)
        .then(() => {
          setCollection(updated);
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
          loadData();
        })
        .catch((err) => LogErr('Failed to remove work:', err));
    },
    [collectionId, loadData]
  );

  const handleSelectedChange = useCallback((work: models.CollectionWork) => {
    SetLastWorkID(work.workID).catch((err) => {
      LogErr('Failed to set lastWorkID:', err);
    });
  }, []);

  const getLastSelectedID = useCallback(async () => {
    // If we have an initial select ID from navigation state, use that first
    if (initialSelectID !== undefined) {
      return initialSelectID;
    }

    const state = await GetAppState();
    return state.lastWorkID;
  }, [initialSelectID]);

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

  const isUneditable = collection.attributes?.includes('uneditable') ?? false;

  return (
    <Stack gap="lg">
      <Paper p="md" withBorder>
        <Group gap="md">
          <ActionIcon variant="subtle" size="lg" onClick={() => navigate('/collections')}>
            <IconArrowLeft size={20} />
          </ActionIcon>
          <IconFolder size={32} />
          <div style={{ flex: 1 }}>
            {isUneditable ? (
              <Text size="lg" fw={600}>
                {collection.collectionName}
              </Text>
            ) : (
              <EditableField value={collection.collectionName} onChange={handleNameChange} />
            )}
            <Group gap="xs" mt={4}>
              {isUneditable ? (
                <Text size="sm" c="dimmed">
                  {collection.type || 'No type'}
                </Text>
              ) : (
                <CollectionFieldSelect
                  collection={collection}
                  field="type"
                  width={100}
                  onUpdate={(updated) => setCollection(updated as models.CollectionView)}
                />
              )}
              <Text size="sm" c="dimmed">
                {works.length} work{works.length !== 1 ? 's' : ''}
              </Text>
            </Group>
          </div>
          {!isUneditable &&
            (collection.attributes?.includes('deleted') ? (
              <Group gap={4}>
                <ActionIcon
                  size="lg"
                  variant="light"
                  color="green"
                  onClick={handleUndelete}
                  aria-label="Restore"
                >
                  <IconRestore size={18} />
                </ActionIcon>
                <ActionIcon
                  size="lg"
                  variant="subtle"
                  color="red"
                  onClick={handlePermanentDeleteClick}
                  aria-label="Remove permanently"
                >
                  <IconX size={18} />
                </ActionIcon>
              </Group>
            ) : (
              <ActionIcon
                size="lg"
                variant="light"
                color="red"
                onClick={handleDelete}
                aria-label="Delete"
              >
                <IconTrash size={18} />
              </ActionIcon>
            ))}
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
            onRowClick={(work) => {
              // Update current history state to include selectID so browser back works
              window.history.replaceState(
                { ...location.state, selectID: work.workID },
                document.title
              );
              navigate(`/works/${work.workID}`, {
                state: {
                  selectID: work.workID,
                  fromCollection: collectionId,
                  collectionWorks: works.map((w) => w.workID),
                },
              });
            }}
            onSelectedChange={handleSelectedChange}
            getLastSelectedID={getLastSelectedID}
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
            onUndelete={handleUndeleteNote}
            onPermanentDelete={handlePermanentDeleteNote}
          />
        </Grid.Col>
      </Grid>
      <ConfirmDeleteModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handlePermanentDelete}
        confirmation={deleteConfirmation}
        loading={deleteLoading}
      />
    </Stack>
  );
}
