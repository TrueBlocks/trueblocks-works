import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, NumberInput, Button, Group, Text, Stack } from '@mantine/core';

export interface MoveToPositionModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: (newPosition: number) => void;
  currentPosition: number;
  totalItems: number;
  itemName?: string;
}

export function MoveToPositionModal({
  opened,
  onClose,
  onConfirm,
  currentPosition,
  totalItems,
  itemName,
}: MoveToPositionModalProps) {
  const [position, setPosition] = useState<number | ''>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (opened) {
      requestAnimationFrame(() => {
        setPosition(currentPosition);
      });
      setTimeout(() => {
        inputRef.current?.select();
      }, 50);
    }
  }, [opened, currentPosition]);

  const handleConfirm = useCallback(() => {
    if (position === '' || position < 0 || position >= totalItems) return;
    onConfirm(position);
    onClose();
  }, [position, totalItems, onConfirm, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [handleConfirm, onClose]
  );

  const isValid = position !== '' && position >= 0 && position < totalItems;

  return (
    <Modal opened={opened} onClose={onClose} title="Move to Position" centered size="sm" trapFocus>
      <Stack gap="md">
        {itemName && (
          <Text size="sm">
            Moving:{' '}
            <Text span fw={600}>
              {itemName}
            </Text>
          </Text>
        )}
        <Text size="sm" c="dimmed">
          Enter a position from 0 to {totalItems - 1} (current: {currentPosition})
        </Text>
        <NumberInput
          ref={inputRef}
          label="New Position"
          value={position}
          onChange={(val) => setPosition(val === '' ? '' : Number(val))}
          min={0}
          max={totalItems - 1}
          onKeyDown={handleKeyDown}
          error={!isValid && position !== '' ? `Position must be 0-${totalItems - 1}` : undefined}
          data-autofocus
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid}>
            Move
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
