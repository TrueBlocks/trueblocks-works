import { Group, Text, ActionIcon } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { models } from '@wailsjs/go/models';
import { UpdateWork } from '@wailsjs/go/main/App';
import { StatusSelect, TypeSelect, QualitySelect, EditableField } from '@/components';
import { LogErr } from '@/utils';
import { ReactNode } from 'react';

interface WorkHeaderProps {
  work: models.Work;
  actions?: ReactNode;
  onWorkUpdate?: (work: models.Work) => void;
}

export function WorkHeader({ work, actions, onWorkUpdate }: WorkHeaderProps) {
  const navigate = useNavigate();

  const handleTitleChange = async (newTitle: string) => {
    if (newTitle === work.title) return;
    const updated = { ...work, title: newTitle };
    try {
      await UpdateWork(updated as models.Work);
      onWorkUpdate?.(updated as models.Work);
    } catch (err) {
      LogErr('Failed to update title:', err);
    }
  };

  return (
    <Group justify="space-between" align="flex-start">
      <Group>
        <ActionIcon variant="subtle" onClick={() => navigate(-1)}>
          <IconArrowLeft size={20} />
        </ActionIcon>
        <div>
          <Group gap="xs" align="baseline">
            <EditableField
              value={work.title}
              onChange={handleTitleChange}
              placeholder="Work title"
              autoFocus
            />
            <Text c="dimmed" size="lg">
              (#{work.workID})
            </Text>
          </Group>
          <Group gap="xs" mt="xs">
            <TypeSelect work={work} onUpdate={onWorkUpdate} />
            <StatusSelect work={work} onUpdate={onWorkUpdate} />
            <QualitySelect work={work} onUpdate={onWorkUpdate} />
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
