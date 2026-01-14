import { useState, useEffect } from 'react';
import { Modal, TextInput, Select, Button, Group, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { GetEnumLists, CreateNewWork } from '@app';
import { models } from '@models';
import { LogErr } from '@/utils';

interface NewWorkModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated?: (work: models.Work) => void;
}

export function NewWorkModal({ opened, onClose, onCreated }: NewWorkModalProps) {
  const [title, setTitle] = useState('');
  const [workType, setWorkType] = useState<string | null>('Poem');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [quality, setQuality] = useState<string | null>('Okay');
  const [status, setStatus] = useState<string | null>('Gestating');
  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const [qualityOptions, setQualityOptions] = useState<string[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (opened) {
      GetEnumLists().then((lists) => {
        setTypeOptions(lists.workTypeList);
        setQualityOptions(lists.qualityList);
        setStatusOptions(lists.statusList);
      });
    }
  }, [opened]);

  const handleSubmit = async () => {
    if (!title || !workType || !year || !quality || !status) {
      return;
    }

    setLoading(true);
    try {
      const work = await CreateNewWork(title, workType, year, quality, status);
      notifications.show({
        title: 'Success',
        message: `Created work: ${title}`,
        color: 'green',
      });
      onCreated?.(work);
      handleClose();
    } catch (err) {
      LogErr('Failed to create work:', err);
      notifications.show({
        title: 'Error',
        message: String(err) || 'Failed to create work',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setWorkType('Poem');
    setYear(new Date().getFullYear().toString());
    setQuality('Okay');
    setStatus('Gestating');
    onClose();
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="New Work" size="md">
      <Stack gap="md">
        <TextInput
          label="Title"
          placeholder="Enter work title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />

        <Select
          label="Type"
          data={typeOptions}
          value={workType}
          onChange={setWorkType}
          required
          searchable
        />

        <TextInput
          label="Year"
          placeholder="2024"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          required
        />

        <Select
          label="Quality"
          data={qualityOptions}
          value={quality}
          onChange={setQuality}
          required
        />

        <Select label="Status" data={statusOptions} value={status} onChange={setStatus} required />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading} disabled={!title || loading}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
