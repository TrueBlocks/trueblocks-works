import { Group, Title, Text, Badge, ActionIcon } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { models } from '@wailsjs/go/models';
import { StatusBadge, QualityBadge } from '@/components';
import { ReactNode } from 'react';

interface WorkHeaderProps {
  work: models.Work;
  actions?: ReactNode;
}

export function WorkHeader({ work, actions }: WorkHeaderProps) {
  const navigate = useNavigate();

  return (
    <Group justify="space-between" align="flex-start">
      <Group>
        <ActionIcon variant="subtle" onClick={() => navigate(-1)}>
          <IconArrowLeft size={20} />
        </ActionIcon>
        <div>
          <Title order={2}>{work.title}</Title>
          <Group gap="xs" mt="xs">
            <Badge variant="light">{work.type}</Badge>
            <StatusBadge status={work.status} />
            <QualityBadge quality={work.quality} />
            {work.year && (
              <Text size="sm" c="dimmed">
                {work.year}
              </Text>
            )}
          </Group>
        </div>
      </Group>
      {actions}
    </Group>
  );
}
