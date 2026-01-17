import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconPlus, IconArrowsExchange } from '@tabler/icons-react';
import { Log, LogErr } from '@/utils';
import {
  GetWorks,
  GetWorksFilterOptions,
  SetLastWorkID,
  GetAppState,
  DeleteWork,
  UndeleteWork,
  GetWorkDeleteConfirmation,
  DeleteWorkPermanent,
  MoveWorkFile,
} from '@app';
import { models, db } from '@models';
import { qualitySortOrder, Quality } from '@/types';
import { notifications } from '@mantine/notifications';
import {
  StatusBadge,
  QualityBadge,
  TypeBadge,
  NewWorkModal,
  ConfirmDeleteModal,
  DataTable,
  Column,
} from '@/components';

interface WorksListProps {
  onWorkClick: (work: models.WorkView) => void;
  onFilteredDataChange: (works: models.WorkView[]) => void;
}

export function WorksList({ onWorkClick, onFilteredDataChange }: WorksListProps) {
  const location = useLocation();
  const [works, setWorks] = useState<models.WorkView[]>([]);
  const [loading, setLoading] = useState(true);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<db.DeleteConfirmation | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletingWorkID, setDeletingWorkID] = useState<number | null>(null);
  const [filterOptions, setFilterOptions] = useState<{
    years: string[];
    types: string[];
    statuses: string[];
    qualities: string[];
  }>({ years: [], types: [], statuses: [], qualities: [] });
  const hasInitialized = useRef(false);

  const loadWorks = useCallback(() => {
    setLoading(true);
    GetWorks()
      .then((data) => setWorks(data || []))
      .catch((err) => LogErr('Failed to load works:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    Promise.all([GetWorks(), GetWorksFilterOptions()])
      .then(([data, options]) => {
        Log('Works loaded:', data?.length || 0);
        setWorks(data || []);
        setFilterOptions({
          years: options.years || [],
          types: options.types || [],
          statuses: options.statuses || [],
          qualities: options.qualities || [],
        });

        const state = location.state as { selectID?: number } | null;
        if (state?.selectID) {
          SetLastWorkID(state.selectID);
          window.history.replaceState({}, document.title);
        }
      })
      .catch((err) => LogErr('Failed to load works:', err))
      .finally(() => setLoading(false));
  }, [location.state]);

  // Reload when showDeleted changes
  useEffect(() => {
    function handleShowDeletedChanged() {
      loadWorks();
    }
    window.addEventListener('showDeletedChanged', handleShowDeletedChanged);
    return () => window.removeEventListener('showDeletedChanged', handleShowDeletedChanged);
  }, [loadWorks]);

  // Reload on Cmd+R
  useEffect(() => {
    function handleReload() {
      loadWorks();
    }
    window.addEventListener('reloadCurrentView', handleReload);
    return () => window.removeEventListener('reloadCurrentView', handleReload);
  }, [loadWorks]);

  const handleCreated = (work: models.Work) => {
    loadWorks();
    onWorkClick({ ...work, collectionList: '', nWords: 0 } as models.WorkView);
  };

  const handleDelete = useCallback(async (work: models.WorkView) => {
    try {
      await DeleteWork(work.workID);
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
    } catch (err) {
      LogErr('Failed to delete work:', err);
      notifications.show({
        message: 'Delete failed',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, []);

  const handleUndelete = useCallback(async (work: models.WorkView) => {
    try {
      await UndeleteWork(work.workID);
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
    } catch (err) {
      LogErr('Failed to restore work:', err);
      notifications.show({
        message: 'Restore failed',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, []);

  const handlePermanentDeleteClick = useCallback(async (work: models.WorkView) => {
    try {
      const conf = await GetWorkDeleteConfirmation(work.workID);
      setDeleteConfirmation(conf);
      setDeletingWorkID(work.workID);
      setDeleteModalOpen(true);
    } catch (err) {
      LogErr('Failed to get delete confirmation:', err);
      notifications.show({
        message: 'Failed to prepare delete',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, []);

  const handlePermanentDelete = useCallback(
    async (archiveDocument: boolean) => {
      if (!deletingWorkID) return;
      setDeleteLoading(true);
      try {
        await DeleteWorkPermanent(deletingWorkID, archiveDocument);
        setDeleteModalOpen(false);
        setDeletingWorkID(null);
        notifications.show({
          message: archiveDocument
            ? 'Work permanently deleted and document archived'
            : 'Work permanently deleted',
          color: 'green',
          autoClose: 3000,
        });
        window.dispatchEvent(new CustomEvent('showDeletedChanged'));
      } catch (err) {
        LogErr('Failed to permanently delete work:', err);
        notifications.show({
          message: 'Permanent delete failed',
          color: 'red',
          autoClose: 5000,
        });
      } finally {
        setDeleteLoading(false);
      }
    },
    [deletingWorkID]
  );

  const handleMove = useCallback(
    async (work: models.WorkView) => {
      try {
        await MoveWorkFile(work.workID);
        loadWorks();
        notifications.show({
          message: 'File moved successfully',
          color: 'green',
          autoClose: 3000,
        });
      } catch (err) {
        LogErr('Failed to move file:', err);
        notifications.show({
          message: 'Move failed',
          color: 'red',
          autoClose: 5000,
        });
      }
    },
    [loadWorks]
  );

  const renderExtraCells = useCallback(
    (work: models.WorkView) => {
      // Only show move icon if backend says file needs to be moved
      if (!work.needsMove) return null;

      return (
        <Tooltip label="Move file to match metadata">
          <ActionIcon
            size="sm"
            variant="subtle"
            color="orange"
            onClick={(e) => {
              e.stopPropagation();
              handleMove(work);
            }}
          >
            <IconArrowsExchange size={16} />
          </ActionIcon>
        </Tooltip>
      );
    },
    [handleMove]
  );

  const handleSelectedChange = useCallback((work: models.WorkView) => {
    SetLastWorkID(work.workID).catch((err) => {
      LogErr('Failed to set lastWorkID:', err);
    });
  }, []);

  const getLastSelectedID = useCallback(async () => {
    const state = await GetAppState();
    return state.lastWorkID;
  }, []);

  const searchFn = useCallback((work: models.WorkView, search: string) => {
    const lower = search.toLowerCase();
    return (
      work.title.toLowerCase().includes(lower) ||
      (work.collectionList?.toLowerCase().includes(lower) ?? false)
    );
  }, []);

  const columns: Column<models.WorkView>[] = useMemo(
    () => [
      { key: 'workID', label: 'ID', width: '5%', render: (w) => w.workID },
      { key: 'title', label: 'Title', width: '28%', render: (w) => w.title },
      {
        key: 'year',
        label: 'Year',
        width: '6%',
        render: (w) => w.year || '-',
        filterOptions: filterOptions.years,
      },
      {
        key: 'type',
        label: 'Type',
        width: '8%',
        render: (w) => <TypeBadge value={w.type} />,
        filterOptions: filterOptions.types,
      },
      {
        key: 'status',
        label: 'Status',
        width: '10%',
        render: (w) => <StatusBadge status={w.status} />,
        filterOptions: filterOptions.statuses,
      },
      {
        key: 'quality',
        label: 'Quality',
        width: '10%',
        render: (w) => <QualityBadge quality={w.quality} />,
        sortValue: (w) => qualitySortOrder[(w.quality || '') as Quality] ?? 9,
        filterOptions: filterOptions.qualities,
      },
      {
        key: 'nWords',
        label: 'Words',
        width: '7%',
        render: (w) => w.nWords?.toLocaleString() || '-',
      },
      {
        key: 'nSubmissions',
        label: 'Subs',
        width: '5%',
        render: (w) => w.nSubmissions || '-',
        filterRange: true,
      },
      {
        key: 'nNotes',
        label: 'Notes',
        width: '5%',
        render: (w) => w.nNotes || '-',
        filterRange: true,
      },
      {
        key: 'collectionList',
        label: 'Collections',
        width: '12%',
        render: (w) => {
          const list = w.collectionList || '';
          return list.length > 30 ? list.substring(0, 30) + '…' : list || '-';
        },
      },
    ],
    [filterOptions]
  );

  return (
    <>
      <DataTable<models.WorkView>
        tableName="works"
        title="Works"
        data={works}
        columns={columns}
        loading={loading}
        getRowKey={(w) => w.workID}
        onRowClick={onWorkClick}
        onSelectedChange={handleSelectedChange}
        onFilteredSortedChange={onFilteredDataChange}
        getLastSelectedID={getLastSelectedID}
        searchFn={searchFn}
        onDelete={handleDelete}
        onUndelete={handleUndelete}
        onPermanentDelete={handlePermanentDeleteClick}
        renderExtraCells={renderExtraCells}
        headerActions={
          <ActionIcon variant="light" size="lg" onClick={() => setNewModalOpen(true)}>
            <IconPlus size={18} />
          </ActionIcon>
        }
      />

      <NewWorkModal
        opened={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onCreated={handleCreated}
      />

      <ConfirmDeleteModal
        opened={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingWorkID(null);
        }}
        onConfirm={handlePermanentDelete}
        confirmation={deleteConfirmation}
        loading={deleteLoading}
      />
    </>
  );
}
