import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { LogErr } from '@/utils';
import {
  GetCollections,
  SetLastCollectionID,
  GetAppState,
  DeleteCollection,
  UndeleteCollection,
  GetCollectionDeleteConfirmation,
  DeleteCollectionPermanent,
} from '@app';
import { models, db } from '@models';
import { DataTable, Column, TypeBadge, ConfirmDeleteModal } from '@/components';
import { notifications } from '@mantine/notifications';

interface CollectionsListProps {
  onCollectionClick: (coll: models.CollectionView) => void;
  onFilteredDataChange: (colls: models.CollectionView[]) => void;
}

export function CollectionsList({ onCollectionClick, onFilteredDataChange }: CollectionsListProps) {
  const location = useLocation();
  const [collections, setCollections] = useState<models.CollectionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const hasInitialized = useRef(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<db.DeleteConfirmation | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletingCollectionID, setDeletingCollectionID] = useState<number | null>(null);

  const loadCollections = useCallback(() => {
    setLoading(true);
    GetCollections()
      .then((colls) => {
        const data = colls || [];
        setCollections(data);
        const types = [...new Set(data.map((c) => c.type).filter(Boolean))] as string[];
        setAvailableTypes(types);
      })
      .catch((err) => LogErr('Failed to load collections:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    GetCollections()
      .then((colls) => {
        const data = colls || [];
        setCollections(data);
        const types = [...new Set(data.map((c) => c.type).filter(Boolean))] as string[];
        setAvailableTypes(types);

        const state = location.state as { selectID?: number } | null;
        if (state?.selectID) {
          SetLastCollectionID(state.selectID);
          window.history.replaceState({}, document.title);
        }
      })
      .catch((err) => LogErr('Failed to load collections:', err))
      .finally(() => setLoading(false));
  }, [location.state]);

  // Reload when showDeleted changes
  useEffect(() => {
    function handleShowDeletedChanged() {
      loadCollections();
    }
    window.addEventListener('showDeletedChanged', handleShowDeletedChanged);
    return () => window.removeEventListener('showDeletedChanged', handleShowDeletedChanged);
  }, [loadCollections]);

  // Reload on Cmd+R
  useEffect(() => {
    function handleReload() {
      loadCollections();
    }
    window.addEventListener('reloadCurrentView', handleReload);
    return () => window.removeEventListener('reloadCurrentView', handleReload);
  }, [loadCollections]);

  const searchFn = useCallback((coll: models.CollectionView, search: string) => {
    return coll.collectionName.toLowerCase().includes(search.toLowerCase());
  }, []);

  const handleSelectedChange = useCallback((coll: models.CollectionView) => {
    SetLastCollectionID(coll.collID).catch((err) => {
      LogErr('Failed to set lastCollectionID:', err);
    });
  }, []);

  const handleDelete = useCallback(async (coll: models.CollectionView) => {
    try {
      await DeleteCollection(coll.collID);
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
    } catch (err) {
      LogErr('Failed to delete collection:', err);
      notifications.show({
        message: 'Delete failed',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, []);

  const handleUndelete = useCallback(async (coll: models.CollectionView) => {
    try {
      await UndeleteCollection(coll.collID);
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
    } catch (err) {
      LogErr('Failed to restore collection:', err);
      notifications.show({
        message: 'Restore failed',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, []);

  const handlePermanentDeleteClick = useCallback(async (coll: models.CollectionView) => {
    try {
      const conf = await GetCollectionDeleteConfirmation(coll.collID);
      setDeleteConfirmation(conf);
      setDeletingCollectionID(coll.collID);
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

  const handlePermanentDelete = useCallback(async () => {
    if (!deletingCollectionID) return;
    setDeleteLoading(true);
    try {
      await DeleteCollectionPermanent(deletingCollectionID);
      setDeleteModalOpen(false);
      setDeletingCollectionID(null);
      notifications.show({
        message: 'Collection permanently deleted',
        color: 'green',
        autoClose: 3000,
      });
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
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
  }, [deletingCollectionID]);

  const getLastSelectedID = useCallback(async () => {
    const state = await GetAppState();
    return state.lastCollectionID;
  }, []);

  const columns: Column<models.CollectionView>[] = useMemo(
    () => [
      { key: 'collID', label: 'ID', width: '4%', render: (c) => c.collID },
      {
        key: 'isBook',
        label: 'Book',
        width: '4%',
        render: (c) => (c.isBook ? '📖' : ''),
      },
      {
        key: 'collectionName',
        label: 'Name',
        width: '45%',
        render: (c) => c.collectionName,
        scrollOnSelect: true,
      },
      {
        key: 'type',
        label: 'Type',
        width: '12%',
        render: (c) => <TypeBadge value={c.type} />,
        filterOptions: availableTypes,
      },
      {
        key: 'nItems',
        label: 'Works',
        width: '10%',
        render: (c) => c.nItems,
      },
      {
        key: 'modifiedAt',
        label: 'Last Modified',
        width: '18%',
        render: (c) => (c.modifiedAt ? new Date(c.modifiedAt + 'Z').toLocaleDateString() : '-'),
      },
    ],
    [availableTypes]
  );

  return (
    <>
      <DataTable<models.CollectionView>
        tableName="collections"
        title="Collections"
        data={collections}
        columns={columns}
        loading={loading}
        getRowKey={(c) => c.collID}
        onRowClick={onCollectionClick}
        onSelectedChange={handleSelectedChange}
        getLastSelectedID={getLastSelectedID}
        onFilteredSortedChange={onFilteredDataChange}
        searchFn={searchFn}
        onDelete={handleDelete}
        onUndelete={handleUndelete}
        onPermanentDelete={handlePermanentDeleteClick}
        canDelete={(c) => !c.attributes?.includes('uneditable')}
      />
      <ConfirmDeleteModal
        opened={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingCollectionID(null);
        }}
        onConfirm={handlePermanentDelete}
        confirmation={deleteConfirmation}
        loading={deleteLoading}
      />
    </>
  );
}
