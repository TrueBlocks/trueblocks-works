import { Modal, Stack, Text, Group, Button, Code, Alert } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

interface MoveFileModalProps {
  opened: boolean;
  onClose: () => void;
  currentPath: string;
  newPath: string;
  onMove: () => void;
  onUpdatePathOnly?: () => void;
}

export function MoveFileModal({
  opened,
  onClose,
  currentPath,
  newPath,
  onMove,
  onUpdatePathOnly,
}: MoveFileModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Move File Confirmation" size="xl">
      <Stack gap="md">
        <Alert icon={<IconAlertTriangle size={16} />} color="yellow" variant="light">
          The file location differs from what the metadata suggests.
        </Alert>

        <Stack gap="xs">
          <Text fw={500} size="sm">
            Current location:
          </Text>
          <Code block style={{ wordBreak: 'break-all' }}>
            {currentPath}
          </Code>
        </Stack>

        <Stack gap="xs">
          <Text fw={500} size="sm">
            Suggested location (based on metadata):
          </Text>
          <Code block style={{ wordBreak: 'break-all' }}>
            {newPath}
          </Code>
        </Stack>

        <Text size="sm" c="dimmed">
          Choose an action:
        </Text>

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          {onUpdatePathOnly && (
            <Button variant="light" onClick={onUpdatePathOnly}>
              Update DB to match file
            </Button>
          )}
          <Button color="yellow" onClick={onMove}>
            Move file to match metadata
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
