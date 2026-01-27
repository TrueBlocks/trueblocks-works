import { useState, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import type { DeleteConfirmation, EntityActions } from '../types';

export interface UseDeleteFlowConfig<TId = number> {
  entityName: string;
  actions: EntityActions<TId>;
  onDeleted?: () => void;
  onUndeleted?: () => void;
  onPermanentlyDeleted?: () => void;
}

export interface DeleteFlowReturn<TId = number> {
  deleteModalOpen: boolean;
  deleteConfirmation: DeleteConfirmation | null;
  deleteLoading: boolean;
  deletingId: TId | null;

  handleDelete: (id: TId) => Promise<void>;
  handleUndelete: (id: TId) => Promise<void>;
  handlePermanentDeleteClick: (id: TId) => Promise<void>;
  handlePermanentDeleteConfirm: () => Promise<void>;
  handleDeleteModalClose: () => void;
}

export function useDeleteFlow<TId = number>(
  config: UseDeleteFlowConfig<TId>
): DeleteFlowReturn<TId> {
  const { entityName, actions, onDeleted, onUndeleted, onPermanentlyDeleted } = config;

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<TId | null>(null);

  const handleDelete = useCallback(
    async (id: TId) => {
      if (!actions.delete) return;

      try {
        await actions.delete(id);
        notifications.show({
          message: `${entityName} deleted`,
          color: 'green',
          autoClose: 3000,
        });
        onDeleted?.();
      } catch (err) {
        notifications.show({
          message: `Failed to delete ${entityName.toLowerCase()}`,
          color: 'red',
          autoClose: 5000,
        });
        throw err;
      }
    },
    [entityName, actions, onDeleted]
  );

  const handleUndelete = useCallback(
    async (id: TId) => {
      if (!actions.undelete) return;

      try {
        await actions.undelete(id);
        notifications.show({
          message: `${entityName} restored`,
          color: 'green',
          autoClose: 3000,
        });
        onUndeleted?.();
      } catch (err) {
        notifications.show({
          message: `Failed to restore ${entityName.toLowerCase()}`,
          color: 'red',
          autoClose: 5000,
        });
        throw err;
      }
    },
    [entityName, actions, onUndeleted]
  );

  const handlePermanentDeleteClick = useCallback(
    async (id: TId) => {
      if (!actions.getDeleteConfirmation) {
        setDeleteConfirmation({
          title: `Delete ${entityName}?`,
          message: `This will permanently delete the ${entityName.toLowerCase()}. This action cannot be undone.`,
          confirmLabel: 'Delete Permanently',
        });
        setDeletingId(id);
        setDeleteModalOpen(true);
        return;
      }

      try {
        const conf = await actions.getDeleteConfirmation(id);
        setDeleteConfirmation(conf);
        setDeletingId(id);
        setDeleteModalOpen(true);
      } catch (err) {
        notifications.show({
          message: `Failed to prepare delete`,
          color: 'red',
          autoClose: 5000,
        });
      }
    },
    [entityName, actions]
  );

  const handlePermanentDeleteConfirm = useCallback(async () => {
    if (!actions.permanentDelete || deletingId === null) return;

    setDeleteLoading(true);
    try {
      await actions.permanentDelete(deletingId);
      setDeleteModalOpen(false);
      setDeletingId(null);
      setDeleteConfirmation(null);
      notifications.show({
        message: `${entityName} permanently deleted`,
        color: 'green',
        autoClose: 3000,
      });
      onPermanentlyDeleted?.();
    } catch (err) {
      notifications.show({
        message: `Failed to permanently delete ${entityName.toLowerCase()}`,
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setDeleteLoading(false);
    }
  }, [entityName, actions, deletingId, onPermanentlyDeleted]);

  const handleDeleteModalClose = useCallback(() => {
    setDeleteModalOpen(false);
    setDeletingId(null);
    setDeleteConfirmation(null);
  }, []);

  return {
    deleteModalOpen,
    deleteConfirmation,
    deleteLoading,
    deletingId,
    handleDelete,
    handleUndelete,
    handlePermanentDeleteClick,
    handlePermanentDeleteConfirm,
    handleDeleteModalClose,
  };
}
