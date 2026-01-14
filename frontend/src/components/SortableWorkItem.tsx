import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, Group, Text, ActionIcon, Badge } from '@mantine/core';
import { IconGripVertical, IconTrash, IconExternalLink } from '@tabler/icons-react';
import { models } from '@models';

interface SortableWorkItemProps {
  work: models.Work;
  onRowClick?: (work: models.Work) => void;
  onRemove?: (workId: number) => void;
}

export function SortableWorkItem({ work, onRowClick, onRemove }: SortableWorkItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: work.workID,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'default',
  };

  return (
    <Card ref={setNodeRef} style={style} padding="xs" radius="sm" withBorder>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <ActionIcon
            variant="subtle"
            size="sm"
            style={{ cursor: 'grab', touchAction: 'none' }}
            {...attributes}
            {...listeners}
          >
            <IconGripVertical size={14} />
          </ActionIcon>
          <Text
            fw={500}
            size="sm"
            lineClamp={1}
            style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            onClick={() => onRowClick?.(work)}
          >
            {work.title || `Work #${work.workID}`}
          </Text>
          {work.status && work.status !== 'Done' && (
            <Badge color="blue" variant="light" size="xs">
              {work.status}
            </Badge>
          )}
        </Group>
        <Group gap={4} wrap="nowrap">
          {onRemove && (
            <ActionIcon
              variant="subtle"
              size="sm"
              color="red"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(work.workID);
              }}
            >
              <IconTrash size={14} />
            </ActionIcon>
          )}
          <ActionIcon variant="subtle" size="sm" onClick={() => onRowClick?.(work)}>
            <IconExternalLink size={14} />
          </ActionIcon>
        </Group>
      </Group>
      <Group gap="xs" mt={4} ml={28}>
        <Text size="xs" c="dimmed">
          {work.docType || 'Unknown type'}
        </Text>
        {work.year && (
          <Badge color="gray" variant="light" size="xs">
            {work.year}
          </Badge>
        )}
        {work.quality && (
          <Badge
            color={work.quality === 'Great' ? 'green' : work.quality === 'Good' ? 'blue' : 'gray'}
            variant="light"
            size="xs"
          >
            {work.quality}
          </Badge>
        )}
      </Group>
    </Card>
  );
}
