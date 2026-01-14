import { ReactNode } from 'react';
import { Group, ActionIcon, Tooltip, Stack, Text } from '@mantine/core';
import {
  IconChevronLeft,
  IconChevronRight,
  IconArrowLeft,
  IconTrash,
  IconRestore,
  IconX,
} from '@tabler/icons-react';

interface DetailHeaderProps {
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;

  currentIndex?: number;
  totalCount?: number;

  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  secondaryRow?: ReactNode;

  actionsLeft?: ReactNode;
  actionsRight?: ReactNode;

  isDeleted?: boolean;
  isUneditable?: boolean;
  onDelete?: () => void;
  onUndelete?: () => void;
  onPermanentDelete?: () => void;
}

export function DetailHeader({
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onBack,
  currentIndex,
  totalCount,
  icon,
  title,
  subtitle,
  secondaryRow,
  actionsLeft,
  actionsRight,
  isDeleted,
  isUneditable,
  onDelete,
  onUndelete,
  onPermanentDelete,
}: DetailHeaderProps) {
  const showPosition = currentIndex !== undefined && totalCount !== undefined && totalCount > 0;
  const positionText =
    hasPrev || hasNext
      ? `${(currentIndex ?? 0) + 1} of ${totalCount}`
      : `item ${(currentIndex ?? 0) + 1}`;

  return (
    <Stack gap={4}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" align="flex-start">
          {/* Navigation icons */}
          <Stack gap={0} align="center">
            <Group gap="sm" wrap="nowrap" align="center" style={{ height: 28 }}>
              <Tooltip label="Back to list">
                <ActionIcon variant="subtle" onClick={onBack} aria-label="Back to list">
                  <IconArrowLeft size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Previous (←)">
                <ActionIcon
                  variant="subtle"
                  onClick={onPrev}
                  disabled={!hasPrev}
                  aria-label="Previous"
                >
                  <IconChevronLeft size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Next (→)">
                <ActionIcon variant="subtle" onClick={onNext} disabled={!hasNext} aria-label="Next">
                  <IconChevronRight size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
            {showPosition && (
              <Text size="xs" c="dimmed" ta="center">
                {positionText}
              </Text>
            )}
          </Stack>

          {/* Title area with icon, title text, and subtitle below */}
          <Stack gap={4}>
            <Group gap="xs" wrap="nowrap" align="center">
              {icon && <>{icon}</>}
              {title}
            </Group>
            {subtitle && <Group gap="xs">{subtitle}</Group>}
          </Stack>
        </Group>

        <Group gap="xs" wrap="nowrap" align="center" style={{ height: 28 }}>
          {actionsLeft}
          {actionsRight}
          {!isUneditable && (
            <>
              {isDeleted ? (
                <Group gap={4}>
                  <Tooltip label="Restore">
                    <ActionIcon
                      size="lg"
                      variant="light"
                      color="green"
                      onClick={onUndelete}
                      aria-label="Restore"
                    >
                      <IconRestore size={18} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Delete permanently">
                    <ActionIcon
                      size="lg"
                      variant="subtle"
                      color="red"
                      onClick={onPermanentDelete}
                      aria-label="Delete permanently"
                    >
                      <IconX size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              ) : (
                onDelete && (
                  <Tooltip label="Delete">
                    <ActionIcon
                      size="lg"
                      variant="light"
                      color="red"
                      onClick={onDelete}
                      aria-label="Delete"
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Tooltip>
                )
              )}
            </>
          )}
        </Group>
      </Group>

      {secondaryRow && <div style={{ marginLeft: 112 }}>{secondaryRow}</div>}
    </Stack>
  );
}
