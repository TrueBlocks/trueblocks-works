import { useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Paper, Title, Text, Group, Stack } from '@mantine/core';
import { models } from '@models';
import { SortableWorkItem } from './SortableWorkItem';

interface SortableWorksPortalProps {
  works: models.Work[];
  onRowClick?: (work: models.Work) => void;
  onRemove?: (workId: number) => void;
  onReorder: (workIds: number[]) => void;
  title?: string;
}

export function SortableWorksPortal({
  works,
  onRowClick,
  onRemove,
  onReorder,
  title = 'Works',
}: SortableWorksPortalProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = works.findIndex((w) => w.workID === active.id);
        const newIndex = works.findIndex((w) => w.workID === over.id);

        const newWorks = arrayMove(works, oldIndex, newIndex);
        const newWorkIds = newWorks.map((w) => w.workID);
        onReorder(newWorkIds);
      }
    },
    [works, onReorder]
  );

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={4}>{title}</Title>
        <Text size="xs" c="dimmed">
          Drag to reorder
        </Text>
      </Group>

      {works.length === 0 ? (
        <Text c="dimmed" size="sm" ta="center">
          No works yet
        </Text>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={works.map((w) => w.workID)}
            strategy={verticalListSortingStrategy}
          >
            <Stack gap="xs">
              {works.map((work) => (
                <SortableWorkItem
                  key={work.workID}
                  work={work}
                  onRowClick={onRowClick}
                  onRemove={onRemove}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      )}
    </Paper>
  );
}
