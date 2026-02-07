import { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  Text,
  Radio,
  Group,
  Button,
  ScrollArea,
  Loader,
  Center,
} from '@mantine/core';
import type { Command } from '@/commands';
import { fieldLabels } from '@/commands';
import { GetEnumLists } from '@app';
import { LogErr } from '@/utils';

interface MarkedWorkInfo {
  workID: number;
  title: string;
  path: string;
}

interface BatchUpdateModalProps {
  opened: boolean;
  onClose: () => void;
  command: Command | null;
  markedWorks: MarkedWorkInfo[];
  onConfirm: (value?: string) => void;
  loading?: boolean;
}

export function BatchUpdateModal({
  opened,
  onClose,
  command,
  markedWorks,
  onConfirm,
  loading = false,
}: BatchUpdateModalProps) {
  const [selectedValue, setSelectedValue] = useState<string>('');
  const [options, setOptions] = useState<string[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Fetch options dynamically when modal opens
  useEffect(() => {
    if (!opened || !command || command.type !== 'field' || !command.field) {
      return;
    }

    let cancelled = false;
    const field = command.field;

    // Use startTransition-like pattern via microtask
    queueMicrotask(() => {
      if (!cancelled) {
        setOptionsLoading(true);
        setSelectedValue('');
      }
    });

    GetEnumLists()
      .then((lists) => {
        if (cancelled) return;
        const fieldToList: Record<string, string[]> = {
          status: lists.statusList || [],
          type: lists.workTypeList || [],
          quality: lists.qualityList || [],
          docType: lists.docTypeList || [],
        };
        setOptions(fieldToList[field] || []);
        setOptionsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        LogErr('Failed to load enum lists:', err);
        setOptions([]);
        setOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [opened, command]);

  if (!command) return null;

  const isFieldCommand = command.type === 'field' && command.field;
  const fieldLabel = command.field ? fieldLabels[command.field] : '';

  const handleConfirm = () => {
    if (isFieldCommand) {
      if (selectedValue) {
        onConfirm(selectedValue);
        setSelectedValue('');
      }
    } else {
      onConfirm();
    }
  };

  const handleClose = () => {
    setSelectedValue('');
    onClose();
  };

  const title = isFieldCommand
    ? `${command.label} for ${markedWorks.length} work${markedWorks.length === 1 ? '' : 's'}`
    : `${command.label} (${markedWorks.length} work${markedWorks.length === 1 ? '' : 's'})`;

  return (
    <Modal opened={opened} onClose={handleClose} title={title} centered size="sm">
      <Stack gap="md">
        {/* Work list */}
        <ScrollArea.Autosize mah={150}>
          <Stack gap={4}>
            {markedWorks.slice(0, 10).map((work) => (
              <Text key={work.workID} size="sm" lineClamp={1}>
                • {work.title}
              </Text>
            ))}
            {markedWorks.length > 10 && (
              <Text size="sm" c="dimmed" fs="italic">
                ...and {markedWorks.length - 10} more
              </Text>
            )}
          </Stack>
        </ScrollArea.Autosize>

        {/* Value picker for field commands */}
        {isFieldCommand && optionsLoading && (
          <Center py="md">
            <Loader size="sm" />
          </Center>
        )}
        {isFieldCommand && !optionsLoading && (
          <Radio.Group
            label={`Select ${fieldLabel}`}
            value={selectedValue}
            onChange={setSelectedValue}
          >
            <Stack gap="xs" mt="xs">
              {options.map((opt) => (
                <Radio key={opt} value={opt} label={opt} />
              ))}
            </Stack>
          </Radio.Group>
        )}

        {/* Action confirmation */}
        {!isFieldCommand && (
          <Text size="sm" c="dimmed">
            {command.description}
          </Text>
        )}

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            loading={loading}
            disabled={isFieldCommand && !selectedValue}
          >
            {isFieldCommand ? 'Apply' : 'Confirm'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
