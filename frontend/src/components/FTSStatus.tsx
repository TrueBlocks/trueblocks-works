import { useState, useEffect } from 'react';
import { Stack, Paper, Group, Text, Button, Progress, Badge, Modal, Alert } from '@mantine/core';
import {
  IconDatabase,
  IconRefresh,
  IconTrash,
  IconAlertCircle,
  IconCheck,
} from '@tabler/icons-react';
import { EventsOn, EventsOff } from '@wailsjs/runtime/runtime';
import { FTSGetStatus, FTSBuildIndex, FTSUpdateIndex, FTSDeleteIndex } from '@app';
import { fts } from '@models';
import { notifications } from '@mantine/notifications';
import { LogErr } from '@/utils';

interface BuildProgress {
  phase: string;
  current: number;
  total: number;
  currentFile: string;
  errors: string[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function FTSStatus() {
  const [status, setStatus] = useState<fts.Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState<BuildProgress | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    FTSGetStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch((err) => {
        LogErr('Failed to load FTS status', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    const handleProgress = (p: BuildProgress) => {
      setProgress(p);
    };

    const handleComplete = () => {
      setBuilding(false);
      setProgress(null);
      setRefreshKey((k) => k + 1);
      notifications.show({
        title: 'Index Built',
        message: 'Full-text search index has been updated',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    };

    const handleError = (error: string) => {
      setBuilding(false);
      setProgress(null);
      notifications.show({
        title: 'Index Build Failed',
        message: error,
        color: 'red',
      });
    };

    EventsOn('fts:progress', handleProgress);
    EventsOn('fts:complete', handleComplete);
    EventsOn('fts:error', handleError);

    return () => {
      EventsOff('fts:progress');
      EventsOff('fts:complete');
      EventsOff('fts:error');
    };
  }, []);

  const handleBuildFull = async () => {
    setBuilding(true);
    setProgress({ phase: 'starting', current: 0, total: 0, currentFile: '', errors: [] });
    try {
      await FTSBuildIndex();
    } catch (err) {
      LogErr('FTS build failed', err);
      setBuilding(false);
    }
  };

  const handleUpdateIncremental = async () => {
    setBuilding(true);
    setProgress({ phase: 'starting', current: 0, total: 0, currentFile: '', errors: [] });
    try {
      await FTSUpdateIndex();
    } catch (err) {
      LogErr('FTS update failed', err);
      setBuilding(false);
    }
  };

  const handleDelete = async () => {
    try {
      await FTSDeleteIndex();
      setShowDeleteConfirm(false);
      setRefreshKey((k) => k + 1);
      notifications.show({
        title: 'Index Deleted',
        message: 'Full-text search index has been removed',
        color: 'blue',
      });
    } catch (err) {
      LogErr('FTS delete failed', err);
      notifications.show({
        title: 'Delete Failed',
        message: 'Failed to delete the search index',
        color: 'red',
      });
    }
  };

  if (loading && !status) {
    return (
      <Paper p="md" withBorder>
        <Text c="dimmed">Loading FTS status...</Text>
      </Paper>
    );
  }

  const hasStaleOrMissing = status && (status.staleCount > 0 || status.missingCount > 0);

  return (
    <>
      <Paper p="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="xs">
              <IconDatabase size={20} />
              <Text fw={500}>Full-Text Search Index</Text>
            </Group>
            <Badge color={status?.available ? 'green' : 'gray'}>
              {status?.available ? 'Available' : 'Not Built'}
            </Badge>
          </Group>

          {status?.available && (
            <Stack gap="xs">
              <Group gap="lg">
                <Text size="sm">
                  <Text span c="dimmed">
                    Documents:{' '}
                  </Text>
                  {formatNumber(status.documentCount)}
                </Text>
                <Text size="sm">
                  <Text span c="dimmed">
                    Words:{' '}
                  </Text>
                  {formatNumber(status.totalWords)}
                </Text>
                <Text size="sm">
                  <Text span c="dimmed">
                    Size:{' '}
                  </Text>
                  {formatBytes(status.indexSize)}
                </Text>
              </Group>

              {hasStaleOrMissing && (
                <Alert icon={<IconAlertCircle size={16} />} color="yellow">
                  {status.staleCount > 0 && `${status.staleCount} stale document(s). `}
                  {status.missingCount > 0 && `${status.missingCount} missing from index. `}
                  Consider updating the index.
                </Alert>
              )}

              {status.lastUpdated && (
                <Text size="xs" c="dimmed">
                  Last updated: {new Date(status.lastUpdated).toLocaleString()}
                </Text>
              )}
            </Stack>
          )}

          {building && progress && (
            <Stack gap="xs">
              <Text size="sm" c="dimmed">
                {progress.phase === 'extracting'
                  ? `Extracting: ${progress.currentFile}`
                  : progress.phase}
              </Text>
              <Progress
                value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0}
                size="sm"
                animated
              />
              <Text size="xs" c="dimmed">
                {progress.current} / {progress.total}
              </Text>
            </Stack>
          )}

          <Group gap="xs">
            <Button
              size="sm"
              leftSection={<IconRefresh size={16} />}
              onClick={status?.available ? handleUpdateIncremental : handleBuildFull}
              loading={building}
              disabled={building}
            >
              {status?.available ? 'Update Index' : 'Build Index'}
            </Button>

            {status?.available && (
              <>
                <Button
                  size="sm"
                  variant="light"
                  leftSection={<IconRefresh size={16} />}
                  onClick={handleBuildFull}
                  loading={building}
                  disabled={building}
                >
                  Rebuild Full
                </Button>

                <Button
                  size="sm"
                  variant="light"
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={building}
                >
                  Delete
                </Button>
              </>
            )}
          </Group>

          <Text size="xs" c="dimmed">
            The full-text search index extracts text from your DOCX and Markdown files, enabling
            content search. Building may take a few minutes for large collections.
          </Text>
        </Stack>
      </Paper>

      <Modal
        opened={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Search Index?"
      >
        <Stack>
          <Text>
            Are you sure you want to delete the full-text search index? You can rebuild it at any
            time.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDelete}>
              Delete Index
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
