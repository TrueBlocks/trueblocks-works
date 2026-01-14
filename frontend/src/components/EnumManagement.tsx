import { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Title,
  Stack,
  Group,
  Text,
  Badge,
  ActionIcon,
  TextInput,
  Button,
  Modal,
  Select,
  Accordion,
  Loader,
} from '@mantine/core';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import { GetDistinctValues, RenameFieldValue } from '@app';
import { LogErr, hashColor } from '@/utils';
import { notifications } from '@mantine/notifications';

interface EnumField {
  table: string;
  column: string;
  label: string;
}

const ENUM_FIELDS: EnumField[] = [
  { table: 'Works', column: 'status', label: 'Work Status' },
  { table: 'Works', column: 'type', label: 'Work Type' },
  { table: 'Works', column: 'quality', label: 'Quality' },
  { table: 'Organizations', column: 'status', label: 'Org Status' },
  { table: 'Organizations', column: 'type', label: 'Org Type' },
  { table: 'Organizations', column: 'my_interest', label: 'My Interest' },
  { table: 'Collections', column: 'type', label: 'Collection Type' },
  { table: 'Notes', column: 'type', label: 'Note Type' },
];

interface FieldValuesProps {
  field: EnumField;
}

function FieldValues({ field }: FieldValuesProps) {
  const [values, setValues] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [renameModal, setRenameModal] = useState<{
    open: boolean;
    oldValue: string;
    newValue: string;
  }>({ open: false, oldValue: '', newValue: '' });
  const [mergeModal, setMergeModal] = useState<{
    open: boolean;
    oldValue: string;
    targetValue: string;
  }>({ open: false, oldValue: '', targetValue: '' });

  const loadValues = useCallback(async () => {
    setLoading(true);
    try {
      const result = await GetDistinctValues(field.table, field.column);
      setValues(result || []);
    } catch (err) {
      LogErr(`Failed to load ${field.label} values:`, err);
    } finally {
      setLoading(false);
    }
  }, [field]);

  useEffect(() => {
    loadValues();
  }, [loadValues]);

  const handleRename = async () => {
    if (!renameModal.newValue.trim() || renameModal.newValue === renameModal.oldValue) {
      setRenameModal({ open: false, oldValue: '', newValue: '' });
      return;
    }

    try {
      await RenameFieldValue(
        field.table,
        field.column,
        renameModal.oldValue,
        renameModal.newValue.trim()
      );
      notifications.show({
        message: 'Renamed',
        color: 'green',
        autoClose: 1000,
      });
      await loadValues();
    } catch (err) {
      notifications.show({
        title: 'Rename Failed',
        message: String(err),
        autoClose: 5000,
        color: 'red',
      });
    }
    setRenameModal({ open: false, oldValue: '', newValue: '' });
  };

  const handleMerge = async () => {
    if (!mergeModal.targetValue || mergeModal.targetValue === mergeModal.oldValue) {
      setMergeModal({ open: false, oldValue: '', targetValue: '' });
      return;
    }

    try {
      await RenameFieldValue(
        field.table,
        field.column,
        mergeModal.oldValue,
        mergeModal.targetValue
      );
      notifications.show({
        message: 'Merged',
        color: 'green',
        autoClose: 1000,
      });
      await loadValues();
    } catch (err) {
      notifications.show({
        title: 'Merge Failed',
        message: String(err),
        color: 'red',
        autoClose: 5000,
      });
    }
    setMergeModal({ open: false, oldValue: '', targetValue: '' });
  };

  if (loading) {
    return <Loader size="sm" />;
  }

  if (values.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No values
      </Text>
    );
  }

  return (
    <>
      <Group gap="xs" wrap="wrap">
        {values.map((value) => (
          <Group key={value} gap={4}>
            <Badge color={hashColor(value)} variant="light">
              {value}
            </Badge>
            <ActionIcon
              size="xs"
              variant="subtle"
              onClick={() => setRenameModal({ open: true, oldValue: value, newValue: value })}
            >
              <IconPencil size={12} />
            </ActionIcon>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="red"
              onClick={() => setMergeModal({ open: true, oldValue: value, targetValue: '' })}
            >
              <IconTrash size={12} />
            </ActionIcon>
          </Group>
        ))}
      </Group>

      <Modal
        opened={renameModal.open}
        onClose={() => setRenameModal({ open: false, oldValue: '', newValue: '' })}
        title={`Rename "${renameModal.oldValue}"`}
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="New name"
            value={renameModal.newValue}
            onChange={(e) => setRenameModal({ ...renameModal, newValue: e.currentTarget.value })}
            autoFocus
          />
          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => setRenameModal({ open: false, oldValue: '', newValue: '' })}
            >
              Cancel
            </Button>
            <Button onClick={handleRename}>Rename</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={mergeModal.open}
        onClose={() => setMergeModal({ open: false, oldValue: '', targetValue: '' })}
        title={`Merge "${mergeModal.oldValue}"`}
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            This will change all records with &quot;{mergeModal.oldValue}&quot; to the selected
            value. This action cannot be undone.
          </Text>
          <Select
            label="Merge into"
            placeholder="Select a value"
            data={values.filter((v) => v !== mergeModal.oldValue)}
            value={mergeModal.targetValue}
            onChange={(val) => setMergeModal({ ...mergeModal, targetValue: val || '' })}
          />
          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => setMergeModal({ open: false, oldValue: '', targetValue: '' })}
            >
              Cancel
            </Button>
            <Button color="red" onClick={handleMerge} disabled={!mergeModal.targetValue}>
              Merge
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

export function EnumManagement() {
  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <Title order={4}>Field Value Management</Title>
        <Text size="sm" c="dimmed">
          Rename or merge field values across your data. Merging moves all records from one value to
          another.
        </Text>

        <Accordion variant="contained">
          {ENUM_FIELDS.map((field) => (
            <Accordion.Item key={`${field.table}-${field.column}`} value={field.label}>
              <Accordion.Control>
                <Group gap="xs">
                  <Text size="sm" fw={500}>
                    {field.label}
                  </Text>
                  <Text size="xs" c="dimmed">
                    ({field.table})
                  </Text>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <FieldValues field={field} />
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </Stack>
    </Paper>
  );
}
