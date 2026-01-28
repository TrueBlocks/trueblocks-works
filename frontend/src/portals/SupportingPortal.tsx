import { useState, useEffect, useCallback } from 'react';
import { Paper, Title, Text, Stack, Group, Button, Tooltip } from '@mantine/core';
import { IconFolder, IconFile, IconFolderOpen, IconExternalLink } from '@tabler/icons-react';
import { fileops } from '@models';
import { GetSupportingInfo, OpenSupportingItem } from '@app';
import { LogErr } from '@/utils';

interface SupportingPortalProps {
  workId: number;
  workPath?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function SupportingPortal({ workId, workPath }: SupportingPortalProps) {
  const [info, setInfo] = useState<fileops.SupportingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadInfo = useCallback(async () => {
    if (!workPath) {
      setInfo(null);
      setLoading(false);
      return;
    }
    try {
      const result = await GetSupportingInfo(workId);
      setInfo(result);
    } catch (err) {
      LogErr('Failed to load supporting info', err);
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, [workId, workPath]);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  const handleOpen = async () => {
    try {
      await OpenSupportingItem(workId);
    } catch (err) {
      LogErr('Failed to open supporting item', err);
    }
  };

  if (loading || !info?.exists) {
    return null;
  }

  return (
    <Paper p="md" withBorder>
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Title order={4}>Supporting</Title>
          <Tooltip label={info.isFolder ? 'Open folder' : 'Open file'}>
            <Button
              size="xs"
              variant="light"
              leftSection={
                info.isFolder ? <IconFolderOpen size={14} /> : <IconExternalLink size={14} />
              }
              onClick={handleOpen}
            >
              Open
            </Button>
          </Tooltip>
        </Group>
        <Group gap="xs">
          {info.isFolder ? (
            <IconFolder size={16} color="var(--mantine-color-yellow-6)" />
          ) : (
            <IconFile size={16} color="var(--mantine-color-blue-6)" />
          )}
          <Text size="xs" c="dimmed">
            {info.isFolder
              ? `${info.count} item${info.count !== 1 ? 's' : ''}`
              : formatBytes(info.size)}
          </Text>
          <Text size="xs" c="dimmed">
            {info.modTime}
          </Text>
        </Group>
      </Stack>
    </Paper>
  );
}
