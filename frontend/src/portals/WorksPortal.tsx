import { Paper, Title, Text, Group, ActionIcon, Badge, Stack, Card } from '@mantine/core';
import { IconPlus, IconExternalLink, IconTrash } from '@tabler/icons-react';
import { models } from '@models';

interface WorksPortalProps {
  works: models.Work[];
  onAdd?: () => void;
  onRowClick?: (work: models.Work) => void;
  onRemove?: (workId: number) => void;
  title?: string;
}

export function WorksPortal({
  works,
  onAdd,
  onRowClick,
  onRemove,
  title = 'Works',
}: WorksPortalProps) {
  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={4}>{title}</Title>
        {onAdd && (
          <ActionIcon variant="light" onClick={onAdd}>
            <IconPlus size={16} />
          </ActionIcon>
        )}
      </Group>

      {works.length === 0 ? (
        <Text c="dimmed" size="sm" ta="center">
          No works yet
        </Text>
      ) : (
        <Stack gap="xs">
          {works.map((work) => (
            <Card
              key={work.workID}
              padding="xs"
              radius="sm"
              withBorder
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              onClick={() => onRowClick?.(work)}
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={500} size="sm" lineClamp={1}>
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
                  <ActionIcon variant="subtle" size="sm">
                    <IconExternalLink size={14} />
                  </ActionIcon>
                </Group>
              </Group>
              <Group gap="xs" mt={4}>
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
                    color={
                      work.quality === 'Great' ? 'green' : work.quality === 'Good' ? 'blue' : 'gray'
                    }
                    variant="light"
                    size="xs"
                  >
                    {work.quality}
                  </Badge>
                )}
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
