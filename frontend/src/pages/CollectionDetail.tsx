import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Stack, ActionIcon, Flex, Loader, Text, Grid, Table, Group } from '@mantine/core';
import { IconPlus, IconX, IconFolder } from '@tabler/icons-react';
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
  SetLastCollectionID,
  GetSubmissionViewsByCollection,
  AddWorkToCollection,
  ReorderCollectionWorks,
  DeleteSubmission,
  UndeleteSubmission,
  DeleteSubmissionPermanent,
  GetTableState,
  SetTableState,
} from '@app';
import { models, db } from '@models';
import { qualitySortOrder, Quality } from '@/types';
import {
  DetailHeader,
  DataTable,
  Column,
  StatusBadge,
  TypeBadge,
  QualityBadge,
  EditableField,
  WorkPickerModal,
  NewWorkModal,
  NotesPortal,
  SubmissionsPortal,
  CollectionFieldSelect,
  ConfirmDeleteModal,
} from '@/components';
import { useNotes } from '@/hooks';

interface CollectionDetailProps {
  collectionId: number;
  filteredCollections: models.CollectionView[];
}

export function CollectionDetail({ collectionId, filteredCollections }: CollectionDetailProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [collection, setCollection] = useState<models.CollectionView | null>(null);
  const [works, setWorks] = useState<models.CollectionWork[]>([]);
  const [sortedFilteredWorks, setSortedFilteredWorks] = useState<models.CollectionWork[]>([]);
  const [submissions, setSubmissions] = useState<models.SubmissionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialSelectID, setInitialSelectID] = useState<number | undefined>(undefined);
  const [workPickerOpen, setWorkPickerOpen] = useState(false);
  const [newWorkModalOpen, setNewWorkModalOpen] = useState(false);
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
  const prevCollectionIdRef = useRef<number | undefined>(undefined);

  const {
    notes,
    handleAdd: handleAddNote,
    handleUpdate: handleUpdateNote,
    handleDelete: handleDeleteNote,
    handleUndelete: handleUndeleteNote,
    handlePermanentDelete: handlePermanentDeleteNote,
  } = useNotes('collection', collectionId);

  const currentIndex = filteredCollections.findIndex((c) => c.collID === collectionId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < filteredCollections.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      const prevColl = filteredCollections[currentIndex - 1];
      navigate(`/collections/${prevColl.collID}`);
    }
  }, [hasPrev, filteredCollections, currentIndex, navigate]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      const nextColl = filteredCollections[currentIndex + 1];
      navigate(`/collections/${nextColl.collID}`);
    }
  }, [hasNext, filteredCollections, currentIndex, navigate]);

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
      const [coll, worksData, subsData] = await Promise.all([
        GetCollection(collectionId),
        GetCollectionWorks(collectionId),
        GetSubmissionViewsByCollection(collectionId),
      ]);

      setCollection(coll as models.CollectionView);
      const data = worksData || [];
      setWorks(data);
      setSubmissions(subsData || []);
      SetLastCollectionID(collectionId);

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

  // Load data on initial mount or when collectionId changes
  useEffect(() => {
    const collectionIdChanged = prevCollectionIdRef.current !== collectionId;
    prevCollectionIdRef.current = collectionId;

    if (!hasInitialized.current || collectionIdChanged) {
      hasInitialized.current = true;
      loadData();
    }
  }, [loadData, collectionId]);

  // Handle selection and reload when returning from detail view
  useEffect(() => {
    const state = location.state as { selectID?: number } | null;
    if (state?.selectID && hasInitialized.current) {
      setInitialSelectID(state.selectID);
      SetLastWorkID(state.selectID).catch((err) => {
        LogErr('Failed to set lastWorkID:', err);
      });
      // Reload data to pick up any changes made while viewing the work
      loadData();
      window.history.replaceState({}, document.title);
    }
  }, [location.state, loadData]);

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

  const handleDeleteSubmission = useCallback(
    async (subId: number) => {
      await DeleteSubmission(subId);
      const updated = await GetSubmissionViewsByCollection(collectionId);
      setSubmissions(updated || []);
    },
    [collectionId]
  );

  const handleUndeleteSubmission = useCallback(
    async (subId: number) => {
      await UndeleteSubmission(subId);
      const updated = await GetSubmissionViewsByCollection(collectionId);
      setSubmissions(updated || []);
    },
    [collectionId]
  );

  // Direct delete without confirmation - used in SubmissionsPortal
  const handlePermanentDeleteSubmissionDirect = useCallback(
    async (subId: number) => {
      try {
        await DeleteSubmissionPermanent(subId);
        const updated = await GetSubmissionViewsByCollection(collectionId);
        setSubmissions(updated || []);
      } catch (err) {
        LogErr('Failed to permanently delete submission:', err);
      }
    },
    [collectionId]
  );

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

  const expandFiltersForWorks = useCallback(
    async (addedWorks: models.WorkView[]) => {
      const tableName = `collection-${collectionId}`;
      try {
        const tableState = await GetTableState(tableName);
        const filters = tableState.filters || {};
        let changed = false;

        for (const work of addedWorks) {
          // Add year if not in filter
          if (work.year && filters.year && !filters.year.includes(work.year)) {
            filters.year = [...filters.year, work.year];
            changed = true;
          }
          // Add status if not in filter
          if (work.status && filters.status && !filters.status.includes(work.status)) {
            filters.status = [...filters.status, work.status];
            changed = true;
          }
          // Add type if not in filter
          if (work.type && filters.type && !filters.type.includes(work.type)) {
            filters.type = [...filters.type, work.type];
            changed = true;
          }
          // Add quality if not in filter
          if (work.quality && filters.quality && !filters.quality.includes(work.quality)) {
            filters.quality = [...filters.quality, work.quality];
            changed = true;
          }
        }

        if (changed) {
          tableState.filters = filters;
          await SetTableState(tableName, tableState);
        }
      } catch (err) {
        LogErr('Failed to expand filters:', err);
      }
    },
    [collectionId]
  );

  const handleReorderWork = useCallback(
    (workKey: string | number, direction: 'up' | 'down') => {
      if (!collectionId) return;
      const workID = typeof workKey === 'string' ? parseInt(workKey, 10) : workKey;
      const currentIndex = works.findIndex((w) => w.workID === workID);
      if (currentIndex === -1) return;

      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= works.length) return;

      // Swap in the array
      const newWorks = [...works];
      [newWorks[currentIndex], newWorks[newIndex]] = [newWorks[newIndex], newWorks[currentIndex]];

      // Update UI optimistically
      setWorks(newWorks);

      // Save new order to backend
      const workIDs = newWorks.map((w) => w.workID);
      ReorderCollectionWorks(collectionId, workIDs).catch((err) => {
        LogErr('Failed to reorder works:', err);
        loadData(); // Revert on error
      });
    },
    [collectionId, works, loadData]
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
      {
        key: 'title',
        label: 'Title',
        width: '30%',
        render: (work) => work.title,
        scrollOnSelect: true,
      },
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
        sortValue: (work) => qualitySortOrder[(work.quality || '') as Quality] ?? 9,
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
      <DetailHeader
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={handlePrev}
        onNext={handleNext}
        onBack={handleReturnToList}
        currentIndex={currentIndex}
        totalCount={filteredCollections.length}
        icon={<IconFolder size={24} />}
        title={
          <Group gap="xs" align="baseline">
            {isUneditable ? (
              <Text size="xl">{collection.collectionName}</Text>
            ) : (
              <EditableField
                value={collection.collectionName}
                onChange={handleNameChange}
                placeholder="Collection name"
                size="xl"
              />
            )}
            <Text c="dark.3" size="md">
              (#{collection.collID})
            </Text>
          </Group>
        }
        subtitle={
          <>
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
          </>
        }
        isDeleted={collection.attributes?.includes('deleted')}
        isUneditable={isUneditable}
        onDelete={handleDelete}
        onUndelete={handleUndelete}
        onPermanentDelete={handlePermanentDeleteClick}
      />

      <Grid>
        <Grid.Col span={{ base: 12, md: 9 }}>
          <DataTable<models.CollectionWork>
            tableName={`collection-${collectionId}`}
            title="Works"
            titleOrder={4}
            data={works}
            columns={columns}
            getRowKey={(work) => work.workID}
            onRowClick={(work) => {
              window.history.replaceState(
                { ...location.state, selectID: work.workID },
                document.title
              );
              navigate(`/works/${work.workID}`, {
                state: {
                  selectID: work.workID,
                  fromCollection: collectionId,
                  collectionWorks: sortedFilteredWorks.map((w) => w.workID),
                },
              });
            }}
            onSelectedChange={handleSelectedChange}
            getLastSelectedID={getLastSelectedID}
            searchFn={searchFn}
            valueGetter={valueGetter}
            onReorder={handleReorderWork}
            onFilteredSortedChange={setSortedFilteredWorks}
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
            onNewWork={() => setNewWorkModalOpen(true)}
            onWorksAdded={expandFiltersForWorks}
          />
          <NewWorkModal
            opened={newWorkModalOpen}
            onClose={() => setNewWorkModalOpen(false)}
            onCreated={async (work) => {
              await AddWorkToCollection(collectionId, work.workID);
              await expandFiltersForWorks([work as unknown as models.WorkView]);
              loadData();
            }}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Stack gap="md">
            <SubmissionsPortal
              submissions={submissions}
              onRowClick={(sub) =>
                navigate(`/submissions/${sub.submissionID}`, {
                  state: { selectID: sub.submissionID },
                })
              }
              onWorkClick={(workId) =>
                navigate(`/works/${workId}`, { state: { selectID: workId } })
              }
              onDelete={handleDeleteSubmission}
              onUndelete={handleUndeleteSubmission}
              onPermanentDelete={handlePermanentDeleteSubmissionDirect}
              displayField="work"
            />
            <NotesPortal
              notes={notes}
              onAdd={handleAddNote}
              onUpdate={handleUpdateNote}
              onDelete={handleDeleteNote}
              onUndelete={handleUndeleteNote}
              onPermanentDelete={handlePermanentDeleteNote}
            />
          </Stack>
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
