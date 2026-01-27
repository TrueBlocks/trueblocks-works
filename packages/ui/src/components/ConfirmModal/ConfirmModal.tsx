import { Modal, Button, Group, Text, Stack, List } from '@mantine/core';

export interface ConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  consequences?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  confirmColor?: string;
}

export function ConfirmModal({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  consequences,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  confirmColor = 'red',
}: ConfirmModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Stack gap="md">
        <Text>{message}</Text>

        {consequences && consequences.length > 0 && (
          <List size="sm" withPadding>
            {consequences.map((consequence, index) => (
              <List.Item key={index}>{consequence}</List.Item>
            ))}
          </List>
        )}

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button color={confirmColor} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
