import { Modal, Text, Stack, Group, Button, Checkbox } from '@mantine/core';
import { useState, useCallback } from 'react';

export interface DeleteConfirmation {
  entityName: string;
  entityType: string;
  noteCount: number;
  submissionCount: number;
  collectionCount: number;
  hasDocument: boolean;
  documentPath: string;
}

export interface ConfirmDeleteModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: (archiveDocument: boolean) => void;
  confirmation: DeleteConfirmation | null;
  loading?: boolean;
  initialArchiveDocument?: boolean;
  onArchiveDocumentChange?: (archive: boolean) => void;
}

export function ConfirmDeleteModal({
  opened,
  onClose,
  onConfirm,
  confirmation,
  loading = false,
  initialArchiveDocument = false,
  onArchiveDocumentChange,
}: ConfirmDeleteModalProps) {
  const [archiveDocument, setArchiveDocument] = useState(initialArchiveDocument);

  const handleArchiveChange = useCallback(
    (checked: boolean) => {
      setArchiveDocument(checked);
      onArchiveDocumentChange?.(checked);
    },
    [onArchiveDocumentChange]
  );

  return (
    <Modal opened={opened} onClose={onClose} title="Permanently Delete" centered size="md">
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
                  • {confirmation.collectionCount} collection membership
                  {confirmation.collectionCount !== 1 ? 's' : ''}
                </Text>
              )}
            </Stack>
          )}

        {confirmation?.hasDocument && (
          <Checkbox
            label="Archive the document file"
            description={`Move "${confirmation.documentPath}" to archive folder instead of deleting`}
            checked={archiveDocument}
            onChange={(event) => handleArchiveChange(event.currentTarget.checked)}
          />
        )}

        <Text size="sm" c="red" fw={500}>
          This action cannot be undone.
        </Text>

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button color="red" onClick={() => onConfirm(archiveDocument)} loading={loading}>
            Delete Permanently
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
