import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Stack,
  ActionIcon,
  Flex,
  Loader,
  Text,
  Grid,
  Table,
  Group,
  Tooltip,
  Modal,
  Button,
  Switch,
  Tabs,
} from '@mantine/core';
import {
  IconPlus,
  IconX,
  IconFolder,
  IconFolderShare,
  IconReorder,
  IconLayoutList,
  IconBook,
  IconEyeOff,
  IconTypography,
  IconChecks,
  IconRocket,
  IconPhoto,
} from '@tabler/icons-react';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { LogErr } from '@/utils';
import { useNavigation } from '@trueblocks/scaffold';
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
  ExportCollectionFolder,
  GetCollectionIsBook,
  SetCollectionIsBook,
  CreateBook,
  GetBookByCollection,
  GetTab,
  SetTab,
  SetWorkSuppressed,
  ToggleCollectionMarks,
  GetCollectionHasMarkedWorks,
  ToggleCollectionSuppressed,
  GetCollectionHasSuppressedWorks,
} from '@app';
import { models, db, state } from '@models';
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
  MoveToPositionModal,
  BookSettingsTab,
  BookTypographyTab,
  AmazonPublishingTab,
  CoverImagesTab,
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
  const navigation = useNavigation();

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
  const [moveToPositionOpen, setMoveToPositionOpen] = useState(false);
  const [moveToPositionWork, setMoveToPositionWork] = useState<{
    workID: number;
    currentIndex: number;
    title: string;
  } | null>(null);
  const [filterOptions, setFilterOptions] = useState({
    years: [] as string[],
    types: [] as string[],
    statuses: [] as string[],
    qualities: [] as string[],
  });
  const [tableState, setTableState] = useState({ hasActiveFilters: false, hasActiveSort: false });
  const [numberAsSortedModalOpen, setNumberAsSortedModalOpen] = useState(false);
  const [isBook, setIsBook] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('contents');
  const [hasMarkedWorks, setHasMarkedWorks] = useState(false);
  const [hasSuppressedWorks, setHasSuppressedWorks] = useState(false);
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

  // Use navigation context for prev/next (populated by CollectionsList)
  const hasPrev = navigation.hasPrev;
  const hasNext = navigation.hasNext;

  // Keep collectionId in sync with navigation
  useEffect(() => {
    navigation.setCurrentId(collectionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId]);

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      navigation.goPrev();
    }
  }, [hasPrev, navigation]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      navigation.goNext();
    }
  }, [hasNext, navigation]);

  const handleReturnToList = useCallback(() => {
    navigate('/collections', { state: { selectID: collectionId } });
  }, [navigate, collectionId]);

  useHotkeys([
    ['mod+shift+ArrowLeft', handleReturnToList],
    ['mod+shift+ArrowUp', handleReturnToList],
  ]);

  const loadData = useCallback(async () => {
    if (!collectionId) return;

    try {
      const [coll, worksData, subsData, isBookResult, savedSubTab, hasMarked, hasSuppressed] =
        await Promise.all([
          GetCollection(collectionId),
          GetCollectionWorks(collectionId),
          GetSubmissionViewsByCollection(collectionId),
          GetCollectionIsBook(collectionId),
          GetTab(`collection-${collectionId}-subtab`),
          GetCollectionHasMarkedWorks(collectionId),
          GetCollectionHasSuppressedWorks(collectionId),
        ]);

      setCollection(coll as models.CollectionView);
      setIsBook(isBookResult);
      setHasMarkedWorks(hasMarked);
      setHasSuppressedWorks(hasSuppressed);
      if (isBookResult && savedSubTab) {
        setActiveTab(savedSubTab);
      } else {
        setActiveTab('contents');
      }
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

  // Cmd+Shift+2: Cycle sub-tabs (Contents/Typography/Book/Covers/Amazon)
  useEffect(() => {
    function handleCycleSubTab() {
      if (!isBook) return;
      const tabs = ['contents', 'typography', 'book', 'covers', 'amazon'];
      const currentIndex = tabs.indexOf(activeTab || 'contents');
      const nextIndex = (currentIndex + 1) % tabs.length;
      const newTab = tabs[nextIndex];
      setActiveTab(newTab);
      SetTab(`collection-${collectionId}-subtab`, newTab);
    }
    window.addEventListener('cycleCollectionSubTab', handleCycleSubTab);
    return () => window.removeEventListener('cycleCollectionSubTab', handleCycleSubTab);
  }, [isBook, activeTab, collectionId]);

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

  const handleExportFolder = useCallback(async () => {
    if (!collection) return;
    try {
      const copied = await ExportCollectionFolder(collection.collID);
      if (copied === 0) {
        return;
      }
      notifications.show({
        message: `Exported ${copied} file${copied !== 1 ? 's' : ''} to folder`,
        color: 'green',
        autoClose: 3000,
      });
    } catch (err) {
      LogErr('Failed to export collection folder:', err);
      notifications.show({
        message: 'Export failed',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, [collection]);

  const handleNumberAsSorted = useCallback(async () => {
    if (!collectionId || sortedFilteredWorks.length === 0) return;
    try {
      const workIDs = sortedFilteredWorks.map((w) => w.workID);
      await ReorderCollectionWorks(collectionId, workIDs);
      // Clear sort to show position-based order (which now matches the sort)
      const currentTableState = await GetTableState(`collection-${collectionId}`);
      const emptySort = new state.ViewSort({
        primary: new state.SortColumn({ column: '', direction: '' }),
        secondary: new state.SortColumn({ column: '', direction: '' }),
        tertiary: new state.SortColumn({ column: '', direction: '' }),
        quaternary: new state.SortColumn({ column: '', direction: '' }),
      });
      const updatedTableState = new state.TableState({
        ...currentTableState,
        sort: emptySort,
      });
      await SetTableState(`collection-${collectionId}`, updatedTableState);
      await loadData();
      notifications.show({
        message: `Numbered ${workIDs.length} work${workIDs.length !== 1 ? 's' : ''} to match current sort`,
        color: 'green',
        autoClose: 3000,
      });
    } catch (err) {
      LogErr('Failed to number works as sorted:', err);
      notifications.show({
        message: 'Failed to number works',
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setNumberAsSortedModalOpen(false);
    }
  }, [collectionId, sortedFilteredWorks, loadData]);

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

  const handleIsBookChange = useCallback(
    async (checked: boolean) => {
      if (!collection) return;
      try {
        await SetCollectionIsBook(collection.collID, checked);
        setIsBook(checked);

        if (checked) {
          const existingBook = await GetBookByCollection(collection.collID);
          if (!existingBook) {
            try {
              const newBook = new models.Book({
                bookID: 0,
                collID: collection.collID,
                title: collection.collectionName,
                author: 'Thomas Jay Rush',
                status: 'draft',
                createdAt: '',
                modifiedAt: '',
              });
              await CreateBook(newBook);
            } catch (createErr) {
              const errMsg = createErr instanceof Error ? createErr.message : String(createErr);
              LogErr('Failed to create book record:', createErr);
              notifications.show({
                title: 'Failed to create book record',
                message: errMsg,
                color: 'red',
                autoClose: 10000,
              });
              await SetCollectionIsBook(collection.collID, false);
              setIsBook(false);
              return;
            }
          }
          setActiveTab('book');
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        LogErr('Failed to set collection as book:', err);
        notifications.show({
          title: 'Failed to update book setting',
          message: errMsg,
          color: 'red',
          autoClose: 10000,
        });
      }
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

  const handleToggleAllMarks = useCallback(async () => {
    if (!collectionId) return;
    try {
      const nowMarked = await ToggleCollectionMarks(collectionId);
      setHasMarkedWorks(nowMarked);
      loadData();
    } catch (err) {
      LogErr('Failed to toggle marks:', err);
      notifications.show({
        message: 'Failed to toggle marks',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, [collectionId, loadData]);

  const handleToggleAllSuppressed = useCallback(async () => {
    if (!collectionId) return;
    try {
      const nowSuppressed = await ToggleCollectionSuppressed(collectionId);
      setHasSuppressedWorks(nowSuppressed);
      loadData();
    } catch (err) {
      LogErr('Failed to toggle suppressed:', err);
      notifications.show({
        message: 'Failed to toggle suppressed',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, [collectionId, loadData]);

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

  const handleOpenMoveToPosition = useCallback(
    (workKey: string | number, currentIndex: number) => {
      const workID = typeof workKey === 'string' ? parseInt(workKey, 10) : workKey;
      const work = works.find((w) => w.workID === workID);
      if (!work) return;
      setMoveToPositionWork({
        workID,
        currentIndex,
        title: work.title,
      });
      setMoveToPositionOpen(true);
    },
    [works]
  );

  const handleMoveToPosition = useCallback(
    (newPosition: number) => {
      if (!collectionId || !moveToPositionWork) return;
      const { currentIndex } = moveToPositionWork;
      if (newPosition === currentIndex) return;

      const newWorks = [...works];
      const [movedWork] = newWorks.splice(currentIndex, 1);
      newWorks.splice(newPosition, 0, movedWork);

      setWorks(newWorks);

      const workIDs = newWorks.map((w) => w.workID);
      ReorderCollectionWorks(collectionId, workIDs).catch((err) => {
        LogErr('Failed to move work to position:', err);
        loadData();
      });
    },
    [collectionId, works, moveToPositionWork, loadData]
  );

  const handleToggleSuppressed = useCallback(
    async (workID: number, currentSuppressed: boolean) => {
      if (!collectionId) return;
      try {
        await SetWorkSuppressed(collectionId, workID, !currentSuppressed);
        // Update local state optimistically
        setWorks((prev) =>
          prev.map((w) => (w.workID === workID ? { ...w, isSuppressed: !currentSuppressed } : w))
        );
      } catch (err) {
        LogErr('Failed to toggle suppressed:', err);
      }
    },
    [collectionId]
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
      {
        key: 'position',
        label: '#',
        width: isBook ? '5%' : '6%',
        render: (work) => {
          const posStr = String(work.position);
          return work.isMarked ? (
            <span>
              <span
                style={{
                  color: 'var(--mantine-color-green-6)',
                  marginRight: 3,
                  fontSize: '0.5em',
                  verticalAlign: 'middle',
                }}
              >
                ●
              </span>
              {posStr}
            </span>
          ) : (
            posStr
          );
        },
      },
      // Suppress column only shown for book collections
      ...(isBook
        ? [
            {
              key: 'suppress' as const,
              label: '',
              width: '3%',
              render: (work: models.CollectionWork) => (
                <Tooltip
                  label={work.isSuppressed ? 'Include in PDF' : 'Exclude from PDF'}
                  position="right"
                >
                  <ActionIcon
                    size="xs"
                    variant={work.isSuppressed ? 'filled' : 'subtle'}
                    color={work.isSuppressed ? 'orange' : 'gray'}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      handleToggleSuppressed(work.workID, work.isSuppressed);
                    }}
                  >
                    <IconEyeOff size={12} />
                  </ActionIcon>
                </Tooltip>
              ),
            },
          ]
        : []),
      {
        key: 'title',
        label: 'Title',
        width: isBook ? '29%' : '30%',
        render: (work) => (
          <Text
            size="sm"
            style={{
              opacity: work.isSuppressed ? 0.5 : 1,
              textDecoration: work.isSuppressed ? 'line-through' : 'none',
            }}
          >
            {work.title}
          </Text>
        ),
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
    [filterOptions, isBook, handleToggleSuppressed]
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

  const getRowStyle = useCallback((work: models.CollectionWork) => {
    if (work.type === 'Section') {
      return {
        borderTop: '2px dashed color-mix(in srgb, var(--mantine-primary-color-5) 25%, transparent)',
      };
    }
    return undefined;
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
    <Stack gap="md">
      <DetailHeader
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={handlePrev}
        onNext={handleNext}
        onBack={handleReturnToList}
        currentIndex={navigation.currentIndex}
        totalCount={navigation.currentLevel?.items.length ?? 0}
        icon={<IconFolder size={24} />}
        title={
          <Group gap="md" align="center">
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
            {!isUneditable && (
              <Switch
                label="Book"
                size="sm"
                checked={isBook}
                onChange={(e) => handleIsBookChange(e.currentTarget.checked)}
              />
            )}
          </Group>
        }
        actionsRight={
          <Group gap="xs">
            <Tooltip label={hasMarkedWorks ? 'Unmark All' : 'Mark All'}>
              <ActionIcon
                size="lg"
                variant="light"
                color={hasMarkedWorks ? 'green' : 'gray'}
                onClick={handleToggleAllMarks}
                aria-label={hasMarkedWorks ? 'Unmark all works' : 'Mark all works'}
              >
                <IconChecks size={18} />
              </ActionIcon>
            </Tooltip>
            {isBook && (
              <Tooltip label={hasSuppressedWorks ? 'Include All in PDF' : 'Exclude All from PDF'}>
                <ActionIcon
                  size="lg"
                  variant="light"
                  color={hasSuppressedWorks ? 'orange' : 'gray'}
                  onClick={handleToggleAllSuppressed}
                  aria-label={hasSuppressedWorks ? 'Include all works' : 'Exclude all works'}
                >
                  <IconEyeOff size={18} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip
              label={
                tableState.hasActiveFilters
                  ? 'Clear filters to number works'
                  : !tableState.hasActiveSort
                    ? 'Sort by a column first'
                    : 'Set positions to match current sort'
              }
            >
              <ActionIcon
                size="lg"
                variant="light"
                color="blue"
                onClick={() => setNumberAsSortedModalOpen(true)}
                disabled={tableState.hasActiveFilters || !tableState.hasActiveSort}
                aria-label="Number as sorted"
              >
                <IconReorder size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Export folder">
              <ActionIcon
                size="lg"
                variant="light"
                color="blue"
                onClick={handleExportFolder}
                aria-label="Export folder"
              >
                <IconFolderShare size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        }
        isDeleted={collection.attributes?.includes('deleted')}
        isUneditable={isUneditable}
        onDelete={handleDelete}
        onUndelete={handleUndelete}
        onPermanentDelete={handlePermanentDeleteClick}
      />

      {isBook ? (
        <Tabs
          orientation="vertical"
          value={activeTab}
          activateTabWithKeyboard={false}
          onChange={(value) => {
            setActiveTab(value);
            if (value) {
              SetTab(`collection-${collectionId}-subtab`, value);
            }
          }}
          style={{ minHeight: 400 }}
          styles={{
            tab: {
              padding: '10px',
              borderRadius: '6px',
              marginBottom: '4px',
              '&[dataActive]': {
                backgroundColor: 'var(--mantine-color-blue-light)',
                color: 'var(--mantine-color-blue-6)',
              },
            },
          }}
        >
          <Tabs.List style={{ width: 50, border: 'none' }}>
            <Tooltip label="Contents" position="right">
              <Tabs.Tab
                value="contents"
                style={{
                  backgroundColor:
                    activeTab === 'contents' ? 'var(--mantine-color-blue-light)' : 'transparent',
                  color: activeTab === 'contents' ? 'var(--mantine-color-blue-6)' : undefined,
                  borderRadius: '6px',
                  padding: '10px',
                }}
              >
                <IconLayoutList size={20} />
              </Tabs.Tab>
            </Tooltip>
            <Tooltip label="Typography" position="right">
              <Tabs.Tab
                value="typography"
                style={{
                  backgroundColor:
                    activeTab === 'typography' ? 'var(--mantine-color-blue-light)' : 'transparent',
                  color: activeTab === 'typography' ? 'var(--mantine-color-blue-6)' : undefined,
                  borderRadius: '6px',
                  padding: '10px',
                }}
              >
                <IconTypography size={20} />
              </Tabs.Tab>
            </Tooltip>
            <Tooltip label="Book Settings" position="right">
              <Tabs.Tab
                value="book"
                style={{
                  backgroundColor:
                    activeTab === 'book' ? 'var(--mantine-color-blue-light)' : 'transparent',
                  color: activeTab === 'book' ? 'var(--mantine-color-blue-6)' : undefined,
                  borderRadius: '6px',
                  padding: '10px',
                }}
              >
                <IconBook size={20} />
              </Tabs.Tab>
            </Tooltip>
            <Tooltip label="Cover Images" position="right">
              <Tabs.Tab
                value="covers"
                style={{
                  backgroundColor:
                    activeTab === 'covers' ? 'var(--mantine-color-blue-light)' : 'transparent',
                  color: activeTab === 'covers' ? 'var(--mantine-color-blue-6)' : undefined,
                  borderRadius: '6px',
                  padding: '10px',
                }}
              >
                <IconPhoto size={20} />
              </Tabs.Tab>
            </Tooltip>
            <Tooltip label="Amazon Publishing" position="right">
              <Tabs.Tab
                value="amazon"
                style={{
                  backgroundColor:
                    activeTab === 'amazon' ? 'var(--mantine-color-blue-light)' : 'transparent',
                  color: activeTab === 'amazon' ? 'var(--mantine-color-blue-6)' : undefined,
                  borderRadius: '6px',
                  padding: '10px',
                }}
              >
                <IconRocket size={20} />
              </Tabs.Tab>
            </Tooltip>
          </Tabs.List>

          <Tabs.Panel value="contents" pl="md" style={{ flex: 1 }}>
            <Grid>
              <Grid.Col span={{ base: 12, md: 9 }}>
                <DataTable<models.CollectionWork>
                  tableName={`collection-${collectionId}`}
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
                  getRowStyle={getRowStyle}
                  onReorder={handleReorderWork}
                  onMoveToPosition={handleOpenMoveToPosition}
                  onFilteredSortedChange={setSortedFilteredWorks}
                  onSortFilterStateChange={setTableState}
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
          </Tabs.Panel>

          <Tabs.Panel value="typography" pl="md" style={{ flex: 1 }}>
            <BookTypographyTab collectionId={collectionId} />
          </Tabs.Panel>

          <Tabs.Panel value="book" pl="md" style={{ flex: 1 }}>
            <BookSettingsTab
              collectionId={collectionId}
              collectionName={collection.collectionName}
            />
          </Tabs.Panel>

          <Tabs.Panel value="covers" pl="md" style={{ flex: 1 }}>
            <CoverImagesTab
              collectionId={collectionId}
              collectionName={collection.collectionName}
            />
          </Tabs.Panel>

          <Tabs.Panel value="amazon" pl="md" style={{ flex: 1 }}>
            <AmazonPublishingTab
              collectionId={collectionId}
              collectionName={collection.collectionName}
            />
          </Tabs.Panel>
        </Tabs>
      ) : (
        <Grid>
          <Grid.Col span={{ base: 12, md: 9 }}>
            <DataTable<models.CollectionWork>
              tableName={`collection-${collectionId}`}
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
              getRowStyle={getRowStyle}
              onReorder={handleReorderWork}
              onMoveToPosition={handleOpenMoveToPosition}
              onFilteredSortedChange={setSortedFilteredWorks}
              onSortFilterStateChange={setTableState}
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
      )}
      <ConfirmDeleteModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handlePermanentDelete}
        confirmation={deleteConfirmation}
        loading={deleteLoading}
      />
      <MoveToPositionModal
        opened={moveToPositionOpen}
        onClose={() => {
          setMoveToPositionOpen(false);
          setMoveToPositionWork(null);
        }}
        onConfirm={handleMoveToPosition}
        currentPosition={moveToPositionWork?.currentIndex ?? 0}
        totalItems={works.length}
        itemName={moveToPositionWork?.title}
      />
      <Modal
        opened={numberAsSortedModalOpen}
        onClose={() => setNumberAsSortedModalOpen(false)}
        title="Number Works As Sorted"
        centered
      >
        <Stack>
          <Text size="sm">
            This will permanently set the position of {sortedFilteredWorks.length}{' '}
            {sortedFilteredWorks.length === 1 ? 'work' : 'works'} to match the current sort order.
            The works will retain this order when sorting is cleared.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setNumberAsSortedModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleNumberAsSorted}>Confirm</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
