import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  TextInput,
  Select,
  Button,
  Group,
  Stack,
  Checkbox,
  ScrollArea,
  Text,
  Divider,
} from '@mantine/core';
import { IconSearch, IconPlus } from '@tabler/icons-react';
import {
  GetCollections,
  GetWorkCollections,
  AddWorkToCollection,
  RemoveWorkFromCollection,
  CreateCollection,
  GetAppState,
  SetLastCollectionType,
} from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import { LogErr, showValidationResult } from '@/utils';
import { TypeBadge } from './TypeBadge';

interface CollectionPickerModalProps {
  opened: boolean;
  onClose: () => void;
  workID: number;
  onUpdate?: () => void;
}

const COLLECTION_TYPES = ['Other', 'Standard', 'Status'];

export function CollectionPickerModal({
  opened,
  onClose,
  workID,
  onUpdate,
}: CollectionPickerModalProps) {
  const [allCollections, setAllCollections] = useState<models.CollectionView[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [originalIds, setOriginalIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<string | null>('Other');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!opened) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [collections, workCollections, appState] = await Promise.all([
          GetCollections(),
          GetWorkCollections(workID),
          GetAppState(),
        ]);

        setAllCollections(collections || []);

        const memberIds = new Set((workCollections || []).map((c) => c.collID));
        setSelectedIds(memberIds);
        setOriginalIds(new Set(memberIds));

        if (appState?.lastCollectionType) {
          setNewType(appState.lastCollectionType);
        }
      } catch (err) {
        LogErr('Failed to load collections:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [opened, workID]);

  const filteredCollections = useMemo(() => {
    if (!search) return allCollections;
    const s = search.toLowerCase();
    return allCollections.filter((c) => c.collectionName.toLowerCase().includes(s));
  }, [allCollections, search]);

  const toggleCollection = (collID: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(collID)) {
        next.delete(collID);
      } else {
        next.add(collID);
      }
      return next;
    });
  };

  const handleCreateNew = async () => {
    if (!newName.trim()) return;

    setCreating(true);
    try {
      const coll = new models.Collection({
        collectionName: newName.trim(),
        type: newType || 'Other',
      });
      const result = await CreateCollection(coll);

      if (showValidationResult(result)) {
        return;
      }

      if (newType) {
        await SetLastCollectionType(newType);
      }

      const updated = await GetCollections();
      setAllCollections(updated || []);

      const created = (updated || []).find((c) => c.collectionName === newName.trim());
      if (created) {
        setSelectedIds((prev) => new Set([...prev, created.collID]));
      }

      setNewName('');
    } catch (err) {
      LogErr('Failed to create collection:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const toAdd = [...selectedIds].filter((id) => !originalIds.has(id));
      const toRemove = [...originalIds].filter((id) => !selectedIds.has(id));

      await Promise.all([
        ...toAdd.map((collID) => AddWorkToCollection(collID, workID)),
        ...toRemove.map((collID) => RemoveWorkFromCollection(collID, workID)),
      ]);

      onUpdate?.();
      handleClose();
    } catch (err) {
      LogErr('Failed to update collections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSearch('');
    setNewName('');
    onClose();
  };

  const hasChanges = useMemo(() => {
    if (selectedIds.size !== originalIds.size) return true;
    for (const id of selectedIds) {
      if (!originalIds.has(id)) return true;
    }
    return false;
  }, [selectedIds, originalIds]);

  return (
    <Modal opened={opened} onClose={handleClose} title="Manage Collections" size="md">
      <Stack gap="md">
        <TextInput
          placeholder="Search collections..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <ScrollArea h={250}>
          {loading ? (
            <Text c="dimmed" ta="center" py="xl">
              Loading...
            </Text>
          ) : filteredCollections.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              {search ? 'No matching collections' : 'No collections yet'}
            </Text>
          ) : (
            <Stack gap="xs">
              {filteredCollections.map((coll) => (
                <Group key={coll.collID} justify="space-between">
                  <Checkbox
                    label={coll.collectionName}
                    checked={selectedIds.has(coll.collID)}
                    onChange={() => toggleCollection(coll.collID)}
                  />
                  <TypeBadge value={coll.type} />
                </Group>
              ))}
            </Stack>
          )}
        </ScrollArea>

        <Divider label="Create New Collection" labelPosition="center" />

        <Group gap="xs" align="flex-end">
          <TextInput
            placeholder="New collection name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ flex: 1 }}
          />
          <Select data={COLLECTION_TYPES} value={newType} onChange={setNewType} w={100} />
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleCreateNew}
            disabled={!newName.trim() || creating}
            loading={creating}
          >
            Add
          </Button>
        </Group>

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges} loading={loading}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
