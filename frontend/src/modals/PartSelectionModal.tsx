import { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  Group,
  Button,
  Text,
  Loader,
  Badge,
  ScrollArea,
  Tooltip,
} from '@mantine/core';
import { IconCheck, IconTrash } from '@tabler/icons-react';
import { GetBookParts, ClearPartCache } from '@app';
import { LogErr } from '@/utils';
import { app } from '@models';

interface PartSelectionModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  collectionId: number;
}

export function PartSelectionModal({
  opened,
  onClose,
  onConfirm,
  collectionId,
}: PartSelectionModalProps) {
  const [parts, setParts] = useState<app.PartInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [clearingPart, setClearingPart] = useState<number | null>(null);

  useEffect(() => {
    if (!opened) return;

    const loadParts = async () => {
      setLoading(true);
      try {
        const partsData = await GetBookParts(collectionId);
        setParts(partsData || []);
      } catch (err) {
        LogErr('Failed to load parts:', err);
      } finally {
        setLoading(false);
      }
    };

    loadParts();
  }, [opened, collectionId]);

  const handleClearAll = async () => {
    setClearingAll(true);
    try {
      await ClearPartCache(collectionId, []);
      // Update local state instead of reloading
      setParts((prev) => prev.map((p) => ({ ...p, isCached: false })));
    } catch (err) {
      LogErr('Failed to clear all caches:', err);
    } finally {
      setClearingAll(false);
    }
  };

  const handleClearPart = async (partId: number) => {
    setClearingPart(partId);
    try {
      await ClearPartCache(collectionId, [partId]);
      // Update local state instead of reloading
      setParts((prev) => prev.map((p) => (p.partId === partId ? { ...p, isCached: false } : p)));
    } catch (err) {
      LogErr('Failed to clear part cache:', err);
    } finally {
      setClearingPart(null);
    }
  };

  const cachedCount = parts.filter((p) => p.isCached).length;
  const needsBuildCount = parts.length - cachedCount;

  return (
    <Modal opened={opened} onClose={onClose} title="Build Galley" size="lg">
      <Stack gap="md">
        {loading ? (
          <Group justify="center" py="xl">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Loading parts...
            </Text>
          </Group>
        ) : (
          <>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                {cachedCount} of {parts.length} parts cached
              </Text>
              {cachedCount > 0 && (
                <Button
                  variant="subtle"
                  color="red"
                  size="xs"
                  leftSection={<IconTrash size={14} />}
                  onClick={handleClearAll}
                  loading={clearingAll}
                >
                  Clear All Caches
                </Button>
              )}
            </Group>

            <ScrollArea.Autosize mah={400}>
              <Stack gap="xs">
                {parts.map((part) => (
                  <Group key={part.partId} justify="space-between" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm">{part.title}</Text>
                      <Text size="xs" c="dimmed">
                        ({part.workCount} works, {part.pageCount} pages)
                      </Text>
                    </Group>
                    {part.isCached ? (
                      <Tooltip label="Click to clear cache">
                        <Badge
                          size="xs"
                          variant="light"
                          color="green"
                          leftSection={
                            clearingPart === part.partId ? (
                              <Loader size={10} color="green" />
                            ) : (
                              <IconCheck size={10} />
                            )
                          }
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleClearPart(part.partId)}
                        >
                          cached
                        </Badge>
                      </Tooltip>
                    ) : (
                      <Badge size="xs" variant="light" color="yellow">
                        needs build
                      </Badge>
                    )}
                  </Group>
                ))}
              </Stack>
            </ScrollArea.Autosize>

            <Text size="xs" c="dimmed">
              Cached parts will be reused. Parts without cache will be built with page numbers and
              headers. Click a cached badge to force rebuild.
            </Text>

            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={onConfirm}>
                {needsBuildCount > 0
                  ? `Build Galley (${needsBuildCount} part${needsBuildCount !== 1 ? 's' : ''} to process)`
                  : 'Build Galley (all cached)'}
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
