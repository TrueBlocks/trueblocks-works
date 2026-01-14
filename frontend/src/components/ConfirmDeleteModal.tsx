import { Modal, Text, Stack, Group, Button, Checkbox } from '@mantine/core';
import { useState, useCallback, useEffect } from 'react';
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

  return (
    <Modal opened={opened} onClose={handleClose} title="Permanently Delete" centered size="md">
      <Stack gap="md">
        <Text size="sm">
          You are about to permanently delete:{' '}
          <Text span fw={700}>
            {confirmation?.entityName}
          </Text>
        </Text>

        {confirmation &&
          (confirmation.noteCount > 0 ||
            confirmation.submissionCount > 0 ||
            confirmation.collectionCount > 0) && (
            <Stack gap="xs">
              <Text size="sm" fw={600} c="red">
                This will also delete:
              </Text>
              {confirmation.noteCount > 0 && (
                <Text size="sm">
                  • {confirmation.noteCount} note{confirmation.noteCount !== 1 ? 's' : ''}
                </Text>
              )}
              {confirmation.submissionCount > 0 && (
                <Text size="sm">
                  • {confirmation.submissionCount} submission
                  {confirmation.submissionCount !== 1 ? 's' : ''}
                </Text>
              )}
              {confirmation.collectionCount > 0 && (
                <Text size="sm">
                  • {confirmation.collectionCount} collection detail record
                  {confirmation.collectionCount !== 1 ? 's' : ''}
                </Text>
              )}
            </Stack>
          )}

        {confirmation?.hasFile && (
          <Checkbox
            label="Archive underlying document to 999 Trash folder"
            checked={archiveDocument}
            onChange={(event) => handleArchiveChange(event.currentTarget.checked)}
          />
        )}

        <Text size="sm" c="red" fw={600}>
          This action cannot be undone!
        </Text>

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={() => onConfirm(archiveDocument)}
            disabled={loading}
            loading={loading}
          >
            Remove Permanently
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
