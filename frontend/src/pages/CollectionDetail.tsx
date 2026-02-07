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
  Image,
  Paper,
  Center,
  Box,
  Checkbox,
} from '@mantine/core';
import {
  IconPlus,
  IconX,
  IconFolder,
  IconFolderShare,
  IconReorder,
  IconLayoutList,
  IconEyeOff,
  IconFileText,
  IconChecks,
  IconRocket,
  IconPhoto,
  IconFilter,
  IconCopy,
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
  SetWorkMarked,
  SetWorksMarked,
  GetCollectionHasMarkedWorks,
  ToggleCollectionSuppressed,
  GetCollectionHasSuppressedWorks,
  GetDistinctValues,
  GetCoverImageData,
  GetMarkedWorksInCollection,
  BatchUpdateWorkField,
  BatchRevealInFinder,
  BatchBackupWorks,
  BatchMoveMarkedFiles,
  GetSettings,
  UpdateSettings,
  DuplicateWork,
} from '@app';
import { models, db, state, settings } from '@models';
import { qualitySortOrder, Quality } from '@/types';
import { DataTable, Column, StatusBadge, QualityBadge, CommandPalette } from '@/components';
import { NotesPortal, SubmissionsPortal } from '@/portals';
import { WorkPickerModal, NewWorkModal, ConfirmDeleteModal, BatchUpdateModal } from '@/modals';
import { MatterView, CoversView, AmazonView } from '@/views';
import {
  DetailHeader,
  TypeBadge,
  EditableField,
  MoveToPositionModal,
  EntityFieldSelect,
} from '@trueblocks/ui';
import { useNotes, useCommandPalette } from '@/hooks';
import type { Command } from '@/commands';

interface CollectionDetailProps {
  collectionId: number;
  filteredCollections: models.CollectionView[];
}

export function CollectionDetail({ collectionId, filteredCollections }: CollectionDetailProps) {
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
  const [dontShowNumberAsSorted, setDontShowNumberAsSorted] = useState(false);
  const settingsRef = useRef<settings.Settings | null>(null);
  const skipNumberAsSortedRef = useRef(false);
  const [isBook, setIsBook] = useState(false);
  const [frontCoverData, setFrontCoverData] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string | null>('contents');
  const [matterSubTab, setMatterSubTab] = useState<string>('titlepage');
  const [hasMarkedWorks, setHasMarkedWorks] = useState(false);
  const [hasSuppressedWorks, setHasSuppressedWorks] = useState(false);
  const [tableKey, setTableKey] = useState(0);
  const hasInitialized = useRef(false);
  const prevCollectionIdRef = useRef<number | undefined>(undefined);
  const selectedWorkRef = useRef<models.CollectionWork | null>(null);

  const {
    notes,
    handleAdd: handleAddNote,
    handleUpdate: handleUpdateNote,
    handleDelete: handleDeleteNote,
    handleUndelete: handleUndeleteNote,
    handlePermanentDelete: handlePermanentDeleteNote,
  } = useNotes('collection', collectionId);

  // Command palette state
  const [selectedCommand, setSelectedCommand] = useState<Command | null>(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [markedWorksInfo, setMarkedWorksInfo] = useState<
    { workID: number; title: string; path: string }[]
  >([]);

  const commandPalette = useCommandPalette({
    scope: 'works',
    enabled: hasMarkedWorks && activeTab === 'contents',
  });

  // Use navigation context for prev/next (populated by CollectionsList)
  const hasPrev = navigation.hasPrev;
  const hasNext = navigation.hasNext;

  // If stack is empty and we have filteredCollections (e.g., on app restart), populate from list
  useEffect(() => {
    if (navigation.stack.length === 0 && filteredCollections.length > 0) {
      const items = filteredCollections.map((c) => ({ id: c.collID }));
      navigation.setItems('collection', items, collectionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredCollections, navigation.stack.length]);

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

  const updateCollectionField = useCallback(async (c: models.Collection) => {
    await UpdateCollection(c);
  }, []);

  const loadCollectionTypeOptions = useMemo(
    () => () => GetDistinctValues('Collections', 'type').then((v) => v || []),
    []
  );

  const loadData = useCallback(async () => {
    if (!collectionId) return;

    try {
      const [
        coll,
        worksData,
        subsData,
        isBookResult,
        savedSubTab,
        savedMatterSubTab,
        hasMarked,
        hasSuppressed,
      ] = await Promise.all([
        GetCollection(collectionId),
        GetCollectionWorks(collectionId),
        GetSubmissionViewsByCollection(collectionId),
        GetCollectionIsBook(collectionId),
        GetTab(`collection-${collectionId}-subtab`),
        GetTab(`collection-${collectionId}-matter-subtab`),
        GetCollectionHasMarkedWorks(collectionId),
        GetCollectionHasSuppressedWorks(collectionId),
      ]);

      setCollection(coll as models.CollectionView);
      setIsBook(isBookResult);
      setHasMarkedWorks(hasMarked);
      setHasSuppressedWorks(hasSuppressed);

      // Load front cover data if this is a book
      if (isBookResult) {
        try {
          const bookData = await GetBookByCollection(collectionId);
          if (bookData?.frontCoverPath) {
            const coverData = await GetCoverImageData(bookData.frontCoverPath);
            setFrontCoverData(coverData);
          } else {
            setFrontCoverData('');
          }
        } catch {
          setFrontCoverData('');
        }
      } else {
        setFrontCoverData('');
      }

      if (isBookResult && savedSubTab) {
        setActiveTab(savedSubTab);
      } else {
        setActiveTab('contents');
      }
      if (savedMatterSubTab) {
        setMatterSubTab(savedMatterSubTab);
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

  // Load skip confirmation settings on mount
  useEffect(() => {
    GetSettings().then((s) => {
      settingsRef.current = s;
      skipNumberAsSortedRef.current = s.skipNumberAsSortedConfirm ?? false;
    });
  }, []);

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

  // Cmd+Shift+2: Cycle main tabs (contents -> matter -> covers -> amazon)
  useEffect(() => {
    const MAIN_TAB_CYCLE = ['contents', 'matter', 'covers', 'amazon'];

    function handleCycleMainTab() {
      if (!isBook) return;

      const currentIndex = MAIN_TAB_CYCLE.indexOf(activeTab || 'contents');
      const nextIndex = (currentIndex + 1) % MAIN_TAB_CYCLE.length;
      const next = MAIN_TAB_CYCLE[nextIndex];

      setActiveTab(next);
      SetTab(`collection-${collectionId}-subtab`, next);
    }
    window.addEventListener('cycleCollectionSubTab', handleCycleMainTab);
    return () => window.removeEventListener('cycleCollectionSubTab', handleCycleMainTab);
  }, [isBook, activeTab, collectionId]);

  // Option+Shift+2: Cycle matter sub-tabs (only when on matter tab)
  useEffect(() => {
    const MATTER_TAB_CYCLE = ['titlepage', 'copyright', 'dedication', 'ack', 'about'];

    function handleCycleMatterTab() {
      if (!isBook) return;
      if (activeTab !== 'matter') return;

      const currentIndex = MATTER_TAB_CYCLE.indexOf(matterSubTab);
      const nextIndex = (currentIndex + 1) % MATTER_TAB_CYCLE.length;
      const next = MATTER_TAB_CYCLE[nextIndex];

      setMatterSubTab(next);
      SetTab(`collection-${collectionId}-matter-subtab`, next);
    }
    window.addEventListener('cycleMatterSubTab', handleCycleMatterTab);
    return () => window.removeEventListener('cycleMatterSubTab', handleCycleMatterTab);
  }, [isBook, activeTab, matterSubTab, collectionId]);

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
      // Save skip preference if checkbox was checked
      if (dontShowNumberAsSorted && settingsRef.current) {
        settingsRef.current.skipNumberAsSortedConfirm = true;
        skipNumberAsSortedRef.current = true;
        await UpdateSettings(settingsRef.current);
      }
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
      setDontShowNumberAsSorted(false);
    }
  }, [collectionId, sortedFilteredWorks, dontShowNumberAsSorted, loadData]);

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
          setActiveTab('contents');
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
    if (sortedFilteredWorks.length === 0) return;

    // Check if any filtered works are marked
    const anyMarked = sortedFilteredWorks.some((w) => w.isMarked);
    const workIDs = sortedFilteredWorks.map((w) => w.workID);

    try {
      // If any are marked, unmark all filtered; otherwise mark all filtered
      await SetWorksMarked(workIDs, !anyMarked);

      // Update local state
      setWorks((prev) => {
        const filteredSet = new Set(workIDs);
        const newWorks = prev.map((w) =>
          filteredSet.has(w.workID) ? { ...w, isMarked: !anyMarked } : w
        );
        setHasMarkedWorks(newWorks.some((w) => w.isMarked));
        return newWorks;
      });
    } catch (err) {
      LogErr('Failed to toggle marks:', err);
      notifications.show({
        message: 'Failed to toggle marks',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, [sortedFilteredWorks]);

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

  const handleToggleSelectedMark = useCallback(async () => {
    const work = selectedWorkRef.current;
    if (!work) return;
    try {
      await SetWorkMarked(work.workID, !work.isMarked);
      setWorks((prev) => {
        const newWorks = prev.map((w) =>
          w.workID === work.workID ? { ...w, isMarked: !work.isMarked } : w
        );
        // Update hasMarkedWorks based on the new state
        setHasMarkedWorks(newWorks.some((w) => w.isMarked));
        return newWorks;
      });
      selectedWorkRef.current = { ...work, isMarked: !work.isMarked };
    } catch (err) {
      LogErr('Failed to toggle mark:', err);
    }
  }, []);

  const handleToggleSelectedSuppressed = useCallback(async () => {
    const work = selectedWorkRef.current;
    if (!work || !collectionId) return;
    try {
      await SetWorkSuppressed(collectionId, work.workID, !work.isSuppressed);
      setWorks((prev) =>
        prev.map((w) => (w.workID === work.workID ? { ...w, isSuppressed: !work.isSuppressed } : w))
      );
      selectedWorkRef.current = { ...work, isSuppressed: !work.isSuppressed };
    } catch (err) {
      LogErr('Failed to toggle suppressed:', err);
    }
  }, [collectionId]);

  const handleDuplicateSelected = useCallback(async () => {
    const work = selectedWorkRef.current;
    if (!work || !collectionId) {
      notifications.show({
        message: 'No work selected',
        color: 'yellow',
        autoClose: 2000,
      });
      return;
    }
    try {
      const newWorkID = await DuplicateWork(work.workID);

      // Get current work order (new work is already added at the end by DuplicateWork)
      const currentWorks = await GetCollectionWorks(collectionId);
      const workIDs = currentWorks.map((w) => w.workID);

      // Find original work position and remove new work from its current position (end)
      const originalIndex = workIDs.indexOf(work.workID);
      const newWorkIndex = workIDs.indexOf(newWorkID);

      if (originalIndex !== -1 && newWorkIndex !== -1) {
        // Remove new work from its current position (end of list)
        workIDs.splice(newWorkIndex, 1);
        // Insert new work right after the original
        workIDs.splice(originalIndex + 1, 0, newWorkID);
        await ReorderCollectionWorks(collectionId, workIDs);
      }

      // Reload and select the new work
      await loadData();
      setInitialSelectID(newWorkID);
      setTableKey((k) => k + 1);

      notifications.show({
        message: 'Work duplicated',
        color: 'green',
        autoClose: 2000,
      });
    } catch (err) {
      LogErr('Failed to duplicate work:', err);
      notifications.show({
        message: 'Duplicate failed',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, [collectionId, loadData]);

  useHotkeys([
    ['mod+shift+M', handleToggleSelectedMark],
    ['mod+shift+S', handleToggleSelectedSuppressed],
    ['mod+D', handleDuplicateSelected],
  ]);

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
    selectedWorkRef.current = work;
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
          return (
            <span style={{ color: work.isMarked ? 'var(--mantine-color-green-6)' : undefined }}>
              <span
                style={{
                  marginRight: 3,
                  fontSize: '0.5em',
                  verticalAlign: 'middle',
                  opacity: work.isMarked ? 1 : 0,
                }}
              >
                ●
              </span>
              {posStr}
            </span>
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

  // Command palette handlers
  const handleSelectCommand = useCallback(
    async (cmd: Command) => {
      commandPalette.close();
      try {
        const marked = await GetMarkedWorksInCollection(collectionId);
        if (marked.length === 0) {
          notifications.show({
            title: 'No works marked',
            message: 'Mark some works first to use batch commands',
            color: 'yellow',
          });
          return;
        }
        setMarkedWorksInfo(marked);
        setSelectedCommand(cmd);
        setBatchModalOpen(true);
      } catch (err) {
        LogErr('Failed to get marked works:', err);
      }
    },
    [collectionId, commandPalette]
  );

  const handleBatchConfirm = useCallback(
    async (value?: string) => {
      if (!selectedCommand) return;
      setBatchLoading(true);
      try {
        const workIDs = markedWorksInfo.map((w) => w.workID);

        if (selectedCommand.type === 'field' && selectedCommand.field && value) {
          const updated = await BatchUpdateWorkField(workIDs, selectedCommand.field, value);
          notifications.show({
            title: 'Success',
            message: `Updated ${updated} work${updated === 1 ? '' : 's'}`,
            color: 'green',
          });
          loadData();
        } else if (selectedCommand.action === 'backupFiles') {
          const backed = await BatchBackupWorks(workIDs);
          notifications.show({
            title: 'Backup Complete',
            message: `Backed up ${backed} file${backed === 1 ? '' : 's'}`,
            color: 'green',
          });
        } else if (selectedCommand.action === 'revealInFinder') {
          const paths = markedWorksInfo.map((w) => w.path).filter((p) => p);
          const opened = await BatchRevealInFinder(paths);
          notifications.show({
            title: 'Finder',
            message: `Opened ${opened} folder${opened === 1 ? '' : 's'}`,
            color: 'green',
          });
        } else if (selectedCommand.action === 'moveFiles') {
          const workIDs = markedWorksInfo.map((w) => w.workID);
          const result = await BatchMoveMarkedFiles(workIDs);
          if (result.moved > 0) {
            notifications.show({
              title: 'Files Moved',
              message: `Moved ${result.moved}, skipped ${result.skipped}, failed ${result.failed}`,
              color: 'green',
            });
            loadData();
          } else if (result.skipped > 0) {
            notifications.show({
              title: 'No Changes',
              message: `All ${result.skipped} file${result.skipped === 1 ? ' is' : 's are'} already at correct path`,
              color: 'blue',
            });
          } else {
            notifications.show({
              title: 'Move Failed',
              message: `Failed to move ${result.failed} file${result.failed === 1 ? '' : 's'}`,
              color: 'red',
            });
          }
        }
      } catch (err) {
        LogErr('Batch operation failed:', err);
        notifications.show({
          title: 'Error',
          message: 'Batch operation failed',
          color: 'red',
        });
      } finally {
        setBatchLoading(false);
        setBatchModalOpen(false);
        setSelectedCommand(null);
        setMarkedWorksInfo([]);
      }
    },
    [selectedCommand, markedWorksInfo, loadData]
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

  const isUneditable = collection.attributes?.includes('uneditable') ?? false;
  const isSmartCollection = !!collection.smartQuery;

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
            {isSmartCollection && (
              <Tooltip label="Smart Collection (dynamic membership)">
                <IconFilter size={20} color="var(--mantine-color-blue-6)" />
              </Tooltip>
            )}
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
              <EntityFieldSelect
                entity={collection}
                field="type"
                loadOptions={loadCollectionTypeOptions}
                updateEntity={updateCollectionField}
                width={100}
                onUpdate={(updated) => setCollection(updated as models.CollectionView)}
                onError={(err, field) => LogErr(`Failed to update ${field}:`, err)}
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
            <Tooltip
              label={
                sortedFilteredWorks.some((w) => w.isMarked) ? 'Unmark Visible' : 'Mark Visible'
              }
            >
              <ActionIcon
                size="lg"
                variant="light"
                color={sortedFilteredWorks.some((w) => w.isMarked) ? 'green' : 'gray'}
                onClick={handleToggleAllMarks}
                aria-label={
                  sortedFilteredWorks.some((w) => w.isMarked)
                    ? 'Unmark visible works'
                    : 'Mark visible works'
                }
              >
                <IconChecks size={18} />
              </ActionIcon>
            </Tooltip>
            {isBook && !isSmartCollection && (
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
            {!isSmartCollection && (
              <Tooltip
                label={
                  tableState.hasActiveFilters
                    ? 'Clear filters to number works'
                    : 'Set positions to match current sort'
                }
              >
                <ActionIcon
                  size="lg"
                  variant="light"
                  color="blue"
                  onClick={() => {
                    if (skipNumberAsSortedRef.current) {
                      handleNumberAsSorted();
                    } else {
                      setNumberAsSortedModalOpen(true);
                    }
                  }}
                  disabled={tableState.hasActiveFilters}
                  aria-label="Number as sorted"
                >
                  <IconReorder size={18} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label="Duplicate selected work (Cmd+D)">
              <ActionIcon
                size="lg"
                variant="light"
                color="blue"
                onClick={handleDuplicateSelected}
                aria-label="Duplicate work"
              >
                <IconCopy size={18} />
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
            <Tooltip label="Matter" position="right">
              <Tabs.Tab
                value="matter"
                style={{
                  backgroundColor:
                    activeTab === 'matter' ? 'var(--mantine-color-blue-light)' : 'transparent',
                  color: activeTab === 'matter' ? 'var(--mantine-color-blue-6)' : undefined,
                  borderRadius: '6px',
                  padding: '10px',
                }}
              >
                <IconFileText size={20} />
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
                  key={tableKey}
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
                  onReorder={isSmartCollection ? undefined : handleReorderWork}
                  onMoveToPosition={isSmartCollection ? undefined : handleOpenMoveToPosition}
                  onFilteredSortedChange={setSortedFilteredWorks}
                  onSortFilterStateChange={setTableState}
                  getMarkedCount={(items) => items.filter((w) => w.isMarked).length}
                  extraColumns={
                    !isSmartCollection ? <Table.Th style={{ width: '50px' }} /> : undefined
                  }
                  renderExtraCells={
                    !isSmartCollection
                      ? (work) => (
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
                        )
                      : undefined
                  }
                  headerActions={
                    !isSmartCollection ? (
                      <ActionIcon variant="light" onClick={() => setWorkPickerOpen(true)}>
                        <IconPlus size={16} />
                      </ActionIcon>
                    ) : undefined
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
                        state: { returnTo: `/collections/${collectionId}` },
                      })
                    }
                    onWorkClick={(workId) =>
                      navigate(`/works/${workId}`, {
                        state: { returnTo: `/collections/${collectionId}` },
                      })
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
                  {isBook && frontCoverData && (
                    <Paper p="md" withBorder>
                      <Text size="sm" fw={500} mb="xs">
                        Cover
                      </Text>
                      <Center>
                        <Box style={{ width: '50%' }}>
                          <Image
                            src={frontCoverData}
                            alt="Book cover"
                            fit="contain"
                            style={{ borderRadius: 4 }}
                          />
                        </Box>
                      </Center>
                    </Paper>
                  )}
                </Stack>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>

          <Tabs.Panel value="matter" pl="md" style={{ flex: 1 }}>
            <MatterView
              collectionId={collectionId}
              collectionName={collection.collectionName}
              activeSubTab={matterSubTab}
              onSubTabChange={(value: string | null) => {
                if (value) {
                  setMatterSubTab(value);
                  SetTab(`collection-${collectionId}-matter-subtab`, value);
                }
              }}
              onNavigateToAmazon={() => setActiveTab('amazon')}
            />
          </Tabs.Panel>

          <Tabs.Panel value="covers" pl="md" style={{ flex: 1 }}>
            <CoversView
              collectionId={collectionId}
              collectionName={collection.collectionName}
              onNavigateToAmazon={() => setActiveTab('amazon')}
            />
          </Tabs.Panel>

          <Tabs.Panel value="amazon" pl="md" style={{ flex: 1 }}>
            <AmazonView collectionId={collectionId} collectionName={collection.collectionName} />
          </Tabs.Panel>
        </Tabs>
      ) : (
        <Grid>
          <Grid.Col span={{ base: 12, md: 9 }}>
            <DataTable<models.CollectionWork>
              key={tableKey}
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
              getMarkedCount={(items) => items.filter((w) => w.isMarked).length}
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
                    state: { returnTo: `/collections/${collectionId}` },
                  })
                }
                onWorkClick={(workId) =>
                  navigate(`/works/${workId}`, {
                    state: { returnTo: `/collections/${collectionId}` },
                  })
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
          <Checkbox
            label="Don't show this confirmation again"
            checked={dontShowNumberAsSorted}
            onChange={(e) => setDontShowNumberAsSorted(e.currentTarget.checked)}
            mt="md"
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setNumberAsSortedModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleNumberAsSorted}>Confirm</Button>
          </Group>
        </Stack>
      </Modal>
      <CommandPalette
        opened={commandPalette.isOpen}
        onClose={commandPalette.close}
        commands={commandPalette.filteredCommands}
        query={commandPalette.query}
        onQueryChange={commandPalette.setQuery}
        selectedIndex={commandPalette.selectedIndex}
        onSelectedIndexChange={commandPalette.setSelectedIndex}
        onSelectCommand={handleSelectCommand}
        markedCount={markedWorksInfo.length || works.filter((w) => w.isMarked).length}
      />
      <BatchUpdateModal
        opened={batchModalOpen}
        onClose={() => {
          setBatchModalOpen(false);
          setSelectedCommand(null);
          setMarkedWorksInfo([]);
        }}
        command={selectedCommand}
        markedWorks={markedWorksInfo}
        onConfirm={handleBatchConfirm}
        loading={batchLoading}
      />
    </Stack>
  );
}
