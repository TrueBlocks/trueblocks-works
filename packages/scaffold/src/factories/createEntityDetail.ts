import { useState, useEffect, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import type { EntityContract, DeleteConfirmation } from '../types';
import { useNavigation } from '../context';
import { useDeleteFlow } from '../hooks';

export interface EntityDetailProps {
  id: number;
  onClose?: () => void;
  onNavigate?: (id: number) => void;
}

export interface EntityDetailReturn<T> {
  item: T | null;
  loading: boolean;
  error: string | null;
  editing: boolean;
  saving: boolean;
  formData: Partial<T>;

  setEditing: (editing: boolean) => void;
  setFormData: React.Dispatch<React.SetStateAction<Partial<T>>>;
  handleSave: () => Promise<void>;
  handleCancel: () => void;
  reload: () => Promise<void>;

  hasPrev: boolean;
  hasNext: boolean;
  goNext: () => void;
  goPrev: () => void;
  goHome: () => void;
  goEnd: () => void;

  deleteModalOpen: boolean;
  deleteConfirmation: DeleteConfirmation | null;
  deleteLoading: boolean;
  handleDelete: () => Promise<void>;
  handleUndelete: () => Promise<void>;
  handlePermanentDeleteClick: () => Promise<void>;
  handlePermanentDeleteConfirm: () => Promise<void>;
  handleDeleteModalClose: () => void;
}

export function createEntityDetail<T extends { id: number; isDeleted: boolean }>(
  contract: EntityContract<T, number>
): (props: EntityDetailProps) => EntityDetailReturn<T> {
  return function useEntityDetail(props: EntityDetailProps): EntityDetailReturn<T> {
    const { id, onClose, onNavigate } = props;
    const navigation = useNavigation();

    const [item, setItem] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState<Partial<T>>({});

    const reload = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = (await contract.actions.get(id)) as T;
        setItem(data);
        setFormData(data as Partial<T>);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }, [id]);

    useEffect(() => {
      void reload();
    }, [reload]);

    useEffect(() => {
      navigation.setCurrentId(id);
    }, [id, navigation]);

    const handleSave = useCallback(async () => {
      if (!contract.actions.update) return;

      setSaving(true);
      try {
        await contract.actions.update(id, formData);
        notifications.show({
          message: `${contract.entityName} saved`,
          color: 'green',
          autoClose: 3000,
        });
        setEditing(false);
        await reload();
        window.dispatchEvent(new CustomEvent(`${contract.entityType}:reload`));
      } catch {
        notifications.show({
          message: `Failed to save ${contract.entityName.toLowerCase()}`,
          color: 'red',
          autoClose: 5000,
        });
      } finally {
        setSaving(false);
      }
    }, [id, formData, reload, contract]);

    const handleCancel = useCallback(() => {
      setEditing(false);
      if (item) {
        setFormData(item as Partial<T>);
      }
    }, [item]);

    const deleteFlow = useDeleteFlow<number>({
      entityName: contract.entityName,
      actions: contract.actions,
      onDeleted: () => {
        void reload();
        window.dispatchEvent(new CustomEvent(`${contract.entityType}:reload`));
      },
      onUndeleted: () => {
        void reload();
        window.dispatchEvent(new CustomEvent(`${contract.entityType}:reload`));
      },
      onPermanentlyDeleted: () => {
        window.dispatchEvent(new CustomEvent(`${contract.entityType}:reload`));
        onClose?.();
      },
    });

    const handleNavigate = useCallback(
      (targetId: number | null) => {
        if (targetId !== null) {
          onNavigate?.(targetId);
        }
      },
      [onNavigate]
    );

    const goNext = useCallback(() => {
      navigation.goNext();
      handleNavigate(navigation.currentId);
    }, [navigation, handleNavigate]);

    const goPrev = useCallback(() => {
      navigation.goPrev();
      handleNavigate(navigation.currentId);
    }, [navigation, handleNavigate]);

    const goHome = useCallback(() => {
      navigation.goHome();
      handleNavigate(navigation.currentId);
    }, [navigation, handleNavigate]);

    const goEnd = useCallback(() => {
      navigation.goEnd();
      handleNavigate(navigation.currentId);
    }, [navigation, handleNavigate]);

    return {
      item,
      loading,
      error,
      editing,
      saving,
      formData,
      setEditing,
      setFormData,
      handleSave,
      handleCancel,
      reload,
      hasPrev: navigation.hasPrev,
      hasNext: navigation.hasNext,
      goNext,
      goPrev,
      goHome,
      goEnd,
      deleteModalOpen: deleteFlow.deleteModalOpen,
      deleteConfirmation: deleteFlow.deleteConfirmation,
      deleteLoading: deleteFlow.deleteLoading,
      handleDelete: () => deleteFlow.handleDelete(id),
      handleUndelete: () => deleteFlow.handleUndelete(id),
      handlePermanentDeleteClick: () => deleteFlow.handlePermanentDeleteClick(id),
      handlePermanentDeleteConfirm: deleteFlow.handlePermanentDeleteConfirm,
      handleDeleteModalClose: deleteFlow.handleDeleteModalClose,
    };
  };
}
