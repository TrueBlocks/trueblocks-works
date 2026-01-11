import { Modal, Text, Stack, Group, Button } from '@mantine/core';
import { db } from '@wailsjs/go/models';

interface ConfirmDeleteModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
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
                  • {confirmation.collectionCount} collection
                  {confirmation.collectionCount !== 1 ? 's' : ''}
                </Text>
              )}
            </Stack>
          )}

        <Text size="sm" c="red" fw={600}>
          This action cannot be undone!
        </Text>

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button color="red" onClick={onConfirm} disabled={loading} loading={loading}>
            Remove Permanently
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
