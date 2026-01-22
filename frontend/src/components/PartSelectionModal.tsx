import { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  Checkbox,
  Group,
  Button,
  Text,
  Anchor,
  Loader,
  Badge,
  ScrollArea,
} from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { GetBookParts, GetPartCacheStatus, GetSavedPartSelection } from '@app';
import { LogErr } from '@/utils';

export interface PartInfo {
  index: number;
  title: string;
  workCount: number;
  pageCount: number;
  isCached: boolean;
}

interface PartSelectionModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: (selectedIndices: number[]) => void;
  collectionId: number;
}

export function PartSelectionModal({
  opened,
  onClose,
  onConfirm,
  collectionId,
}: PartSelectionModalProps) {
  const [parts, setParts] = useState<PartInfo[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!opened) return;

    const loadParts = async () => {
      setLoading(true);
      try {
        const [partsData, cacheStatus, savedSelection] = await Promise.all([
          GetBookParts(collectionId),
          GetPartCacheStatus(collectionId),
          GetSavedPartSelection(collectionId),
        ]);

        const partsWithCache = (partsData || []).map((p: PartInfo, idx: number) => ({
          ...p,
          index: idx,
          isCached: cacheStatus?.[idx] || false,
        }));

        setParts(partsWithCache);
        // Use saved selection if available, otherwise select all parts
        if (savedSelection && savedSelection.length > 0) {
          setSelected(new Set(savedSelection));
        } else {
          setSelected(new Set(partsWithCache.map((_: PartInfo, i: number) => i)));
        }
      } catch (err) {
        LogErr('Failed to load parts:', err);
      } finally {
        setLoading(false);
      }
    };

    loadParts();
  }, [opened, collectionId]);

  const togglePart = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(parts.map((_, i) => i)));
  };

  const selectNone = () => {
    setSelected(new Set());
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selected).sort((a, b) => a - b));
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Select Parts to Build" size="md">
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
            <Group justify="flex-start" gap="xs">
              <Anchor size="sm" onClick={selectAll}>
                All
              </Anchor>
              <Text size="sm" c="dimmed">
                |
              </Text>
              <Anchor size="sm" onClick={selectNone}>
                None
              </Anchor>
            </Group>

            <ScrollArea.Autosize mah={400}>
              <Stack gap="xs">
                {parts.map((part) => (
                  <Group key={part.index} justify="space-between" wrap="nowrap">
                    <Checkbox
                      checked={selected.has(part.index)}
                      onChange={() => togglePart(part.index)}
                      label={
                        <Group gap="xs" wrap="nowrap">
                          <Text size="sm">{part.title}</Text>
                          <Text size="xs" c="dimmed">
                            ({part.workCount} works, {part.pageCount} pages)
                          </Text>
                        </Group>
                      }
                    />
                    {part.isCached && (
                      <Badge
                        size="xs"
                        variant="light"
                        color="green"
                        leftSection={<IconCheck size={10} />}
                      >
                        cached
                      </Badge>
                    )}
                  </Group>
                ))}
              </Stack>
            </ScrollArea.Autosize>

            <Text size="xs" c="dimmed">
              All parts will be included in the book. Selected parts will have page numbers and
              headers applied; unselected parts will be merged without overlays.
            </Text>

            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={selected.size === 0}>
                Apply Overlays to {selected.size} Part{selected.size !== 1 ? 's' : ''}
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
