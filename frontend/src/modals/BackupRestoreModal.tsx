import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Button,
  Table,
  ActionIcon,
  TextInput,
  Loader,
  Checkbox,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash, IconDownload, IconPlus } from '@tabler/icons-react';
import {
  ListBackups,
  CreateBackup,
  RestoreBackupAndQuit,
  DeleteBackup,
  GetSettings,
  UpdateSettings,
} from '@app';
import { backup, settings } from '@models';
import { LogErr } from '@/utils';

interface BackupRestoreModalProps {
  opened: boolean;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

export function BackupRestoreModal({ opened, onClose }: BackupRestoreModalProps) {
  const [backups, setBackups] = useState<backup.BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const settingsRef = useRef<settings.Settings | null>(null);
  const skipDeleteConfirmRef = useRef(false);

  const loadBackups = useCallback(async () => {
    setLoading(true);
    try {
      const list = await ListBackups();
      setBackups(list || []);
    } catch (err) {
      LogErr('Failed to load backups:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (opened) {
      loadBackups();
      // Load settings to check skip preference
      GetSettings()
        .then((s) => {
          settingsRef.current = s;
          skipDeleteConfirmRef.current = s.skipDeleteBackupConfirm || false;
        })
        .catch((err) => LogErr('Failed to load settings:', err));
    }
  }, [opened, loadBackups]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await CreateBackup(newLabel);
      setNewLabel('');
      setShowCreate(false);
      await loadBackups();
    } catch (err) {
      LogErr('Failed to create backup:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async () => {
    if (!confirmRestore) return;
    try {
      // This will close the database and quit the app
      await RestoreBackupAndQuit(confirmRestore);
      // App will quit, so this code won't run
    } catch (err) {
      LogErr('Failed to restore backup:', err);
      setConfirmRestore(null);
      notifications.show({
        title: 'Restore failed',
        message: 'Could not restore backup. Check logs for details.',
        color: 'red',
      });
    }
  };

  const handleDeleteClick = (path: string) => {
    if (skipDeleteConfirmRef.current) {
      // Skip confirmation, delete directly
      doDelete(path);
    } else {
      setConfirmDelete(path);
      setDontShowAgain(false);
    }
  };

  const doDelete = async (path: string) => {
    try {
      await DeleteBackup(path);
      await loadBackups();
    } catch (err) {
      LogErr('Failed to delete backup:', err);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;

    // Save preference if checkbox is checked
    if (dontShowAgain && settingsRef.current) {
      try {
        await UpdateSettings({ ...settingsRef.current, skipDeleteBackupConfirm: true });
        skipDeleteConfirmRef.current = true;
      } catch (err) {
        LogErr('Failed to save settings:', err);
      }
    }

    await doDelete(confirmDelete);
    setConfirmDelete(null);
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Backup & Restore" size="lg">
      <Stack gap="md">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {backups.length} backup{backups.length !== 1 ? 's' : ''} available
          </Text>
          {showCreate ? (
            <Group gap="xs">
              <TextInput
                placeholder="Label (optional)"
                size="xs"
                value={newLabel}
                onChange={(e) => setNewLabel(e.currentTarget.value)}
                style={{ width: 150 }}
              />
              <Button size="xs" onClick={handleCreate} loading={creating}>
                Create
              </Button>
              <Button size="xs" variant="subtle" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </Group>
          ) : (
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => setShowCreate(true)}
            >
              New Backup
            </Button>
          )}
        </Group>

        {loading ? (
          <Loader size="sm" />
        ) : backups.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            No backups yet
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Size</Table.Th>
                <Table.Th w={80}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {backups.map((b) => (
                <Table.Tr key={b.path}>
                  <Table.Td>
                    <Text size="sm">{b.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {formatDate(b.createdAt as unknown as string)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {formatBytes(b.size)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="blue"
                        onClick={() => setConfirmRestore(b.path)}
                        title="Restore"
                      >
                        <IconDownload size={14} />
                      </ActionIcon>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={() => handleDeleteClick(b.path)}
                        title="Delete"
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        <Text size="xs" c="dimmed">
          Backups are created automatically daily and kept for 30 days (max 10).
        </Text>
      </Stack>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete Backup"
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text size="sm">Are you sure you want to delete this backup?</Text>
          <Checkbox
            label="Do not show this confirmation in the future"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.currentTarget.checked)}
            size="sm"
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDelete}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Restore Confirmation Modal */}
      <Modal
        opened={confirmRestore !== null}
        onClose={() => setConfirmRestore(null)}
        title="Restore Backup"
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Restore this backup? Current data will be replaced and the app will quit. You will need
            to reopen the app after restore.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmRestore(null)}>
              Cancel
            </Button>
            <Button color="blue" onClick={handleRestore}>
              Restore &amp; Quit
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Modal>
  );
}
