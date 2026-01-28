import { useState, useEffect, useCallback } from 'react';
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
} from '@mantine/core';
import { IconTrash, IconDownload, IconPlus } from '@tabler/icons-react';
import { ListBackups, CreateBackup, RestoreBackup, DeleteBackup } from '@app';
import { backup } from '@models';
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

  const handleRestore = async (backupPath: string) => {
    if (!confirm('Restore this backup? Current data will be replaced.')) return;
    try {
      await RestoreBackup(backupPath);
      alert('Backup restored. Please restart the app.');
      onClose();
    } catch (err) {
      LogErr('Failed to restore backup:', err);
      alert('Failed to restore backup');
    }
  };

  const handleDelete = async (backupPath: string) => {
    if (!confirm('Delete this backup?')) return;
    try {
      await DeleteBackup(backupPath);
      await loadBackups();
    } catch (err) {
      LogErr('Failed to delete backup:', err);
    }
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
                        onClick={() => handleRestore(b.path)}
                        title="Restore"
                      >
                        <IconDownload size={14} />
                      </ActionIcon>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={() => handleDelete(b.path)}
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
    </Modal>
  );
}
