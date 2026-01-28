import { useState, useCallback, useEffect } from 'react';
import { ConfirmDeleteModal as BaseConfirmDeleteModal, DeleteConfirmation } from '@trueblocks/ui';
import { db } from '@models';
import { GetSettings, UpdateSettings } from '@app';
import { LogErr } from '@/utils';

interface ConfirmDeleteModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: (archiveDocument: boolean) => void;
  confirmation: db.DeleteConfirmation | null;
  loading?: boolean;
}

export function ConfirmDeleteModal({
  opened,
  onClose,
  onConfirm,
  confirmation,
  loading = false,
}: ConfirmDeleteModalProps) {
  const [archiveDocument, setArchiveDocument] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    if (opened && !settingsLoaded) {
      GetSettings()
        .then((s) => {
          setArchiveDocument(s.archiveOnDelete);
          setSettingsLoaded(true);
        })
        .catch((err) => LogErr('Failed to load settings:', err));
    }
  }, [opened, settingsLoaded]);

  const handleArchiveChange = useCallback(async (checked: boolean) => {
    setArchiveDocument(checked);
    try {
      const s = await GetSettings();
      s.archiveOnDelete = checked;
      await UpdateSettings(s);
    } catch (err) {
      LogErr('Failed to save archive setting:', err);
    }
  }, []);

  const handleClose = useCallback(() => {
    setSettingsLoaded(false);
    onClose();
  }, [onClose]);

  const mappedConfirmation: DeleteConfirmation | null = confirmation
    ? {
        entityName: confirmation.entityName,
        entityType: confirmation.entityType,
        noteCount: confirmation.noteCount,
        submissionCount: confirmation.submissionCount,
        collectionCount: confirmation.collectionCount,
        hasDocument: confirmation.hasFile,
        documentPath: confirmation.filePath,
      }
    : null;

  return (
    <BaseConfirmDeleteModal
      opened={opened}
      onClose={handleClose}
      onConfirm={onConfirm}
      confirmation={mappedConfirmation}
      loading={loading}
      initialArchiveDocument={archiveDocument}
      onArchiveDocumentChange={handleArchiveChange}
    />
  );
}
