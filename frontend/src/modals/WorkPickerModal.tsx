import { useState, useEffect, useMemo } from 'react';
import { Modal, TextInput, Button, Group, Stack, Checkbox, ScrollArea, Text } from '@mantine/core';
import { IconSearch, IconPlus } from '@tabler/icons-react';
import { GetWorks, GetCollectionWorks, AddWorkToCollection } from '@app';
import { models } from '@models';
import { LogErr } from '@/utils';
import { TypeBadge } from '@trueblocks/ui';

interface WorkPickerModalProps {
  opened: boolean;
  onClose: () => void;
  collectionID: number;
  onUpdate?: () => void;
  onNewWork?: () => void;
  onWorksAdded?: (works: models.WorkView[]) => void;
}

export function WorkPickerModal({
  opened,
  onClose,
  collectionID,
  onUpdate,
  onNewWork,
  onWorksAdded,
}: WorkPickerModalProps) {
  const [allWorks, setAllWorks] = useState<models.WorkView[]>([]);
  const [memberWorkIds, setMemberWorkIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [works, collectionWorks] = await Promise.all([
          GetWorks(),
          GetCollectionWorks(collectionID),
        ]);

        setAllWorks(works || []);

        const existingIds = new Set((collectionWorks || []).map((w) => w.workID));
        setMemberWorkIds(existingIds);
        setSelectedIds(new Set());
      } catch (err) {
        LogErr('Failed to load works:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [opened, collectionID]);

  const availableWorks = useMemo(() => {
    return allWorks.filter((w) => !memberWorkIds.has(w.workID));
  }, [allWorks, memberWorkIds]);

  const filteredWorks = useMemo(() => {
    if (!search) return availableWorks;
    const s = search.toLowerCase();
    return availableWorks.filter(
      (w) =>
        w.title.toLowerCase().includes(s) ||
        w.type?.toLowerCase().includes(s) ||
        w.year?.toLowerCase().includes(s)
    );
  }, [availableWorks, search]);

  const toggleWork = (workID: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(workID)) {
        next.delete(workID);
      } else {
        next.add(workID);
      }
      return next;
    });
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;

    setSaving(true);
    try {
      await Promise.all(
        [...selectedIds].map((workID) => AddWorkToCollection(collectionID, workID))
      );

      // Pass the added works so parent can update filters
      const addedWorks = allWorks.filter((w) => selectedIds.has(w.workID));
      onWorksAdded?.(addedWorks);
      onUpdate?.();
      handleClose();
    } catch (err) {
      LogErr('Failed to add works to collection:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSearch('');
    setSelectedIds(new Set());
    onClose();
  };

  const handleNewWork = () => {
    handleClose();
    onNewWork?.();
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Add Works to Collection" size="lg">
      <Stack gap="md">
        <Group justify="space-between">
          <TextInput
            placeholder="Search works..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          {onNewWork && (
            <Button variant="light" leftSection={<IconPlus size={16} />} onClick={handleNewWork}>
              New Work
            </Button>
          )}
        </Group>

        <ScrollArea h={350}>
          {loading ? (
            <Text c="dimmed" ta="center" py="xl">
              Loading...
            </Text>
          ) : filteredWorks.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              {search ? 'No matching works' : 'All works are already in this collection'}
            </Text>
          ) : (
            <Stack gap="xs">
              {filteredWorks.map((work) => (
                <Group key={work.workID} justify="space-between">
                  <Checkbox
                    label={work.title}
                    checked={selectedIds.has(work.workID)}
                    onChange={() => toggleWork(work.workID)}
                  />
                  <Group gap="xs">
                    <TypeBadge value={work.type} />
                    <Text size="xs" c="dimmed">
                      {work.year || '-'}
                    </Text>
                  </Group>
                </Group>
              ))}
            </Stack>
          )}
        </ScrollArea>

        <Group justify="space-between" mt="md">
          <Text size="sm" c="dimmed">
            {selectedIds.size} selected
          </Text>
          <Group>
            <Button variant="subtle" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={selectedIds.size === 0} loading={saving}>
              Add Selected
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
