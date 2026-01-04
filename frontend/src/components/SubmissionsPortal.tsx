import { Paper, Title, Text, Group, ActionIcon, Badge, Stack, Card } from '@mantine/core';
import { IconPlus, IconExternalLink, IconTrash } from '@tabler/icons-react';
import { models } from '@wailsjs/go/models';
import { ResponseBadge } from '@/components';
import dayjs from 'dayjs';

interface SubmissionsPortalProps {
  submissions: models.SubmissionView[];
  onAdd?: () => void;
  onRowClick?: (sub: models.SubmissionView) => void;
  onDelete?: (subId: number) => void;
  displayField?: 'journal' | 'work';
}

function isActive(sub: models.SubmissionView): boolean {
  return sub.decisionPending === 'yes';
}

export function SubmissionsPortal({
  submissions,
  onAdd,
  onRowClick,
  onDelete,
  displayField = 'journal',
}: SubmissionsPortalProps) {
  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={4}>Submissions</Title>
        {onAdd && (
          <ActionIcon variant="light" onClick={onAdd}>
            <IconPlus size={16} />
          </ActionIcon>
        )}
      </Group>

      {submissions.length === 0 ? (
        <Text c="dimmed" size="sm" ta="center">
          No submissions yet
        </Text>
      ) : (
        <Stack gap="xs">
          {submissions.map((sub) => (
            <Card
              key={sub.submissionID}
              padding="xs"
              radius="sm"
              withBorder
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              onClick={() => onRowClick?.(sub)}
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={500} size="sm" lineClamp={1}>
                    {displayField === 'work'
                      ? sub.titleOfWork || `Work #${sub.workID}`
                      : sub.journalName || `Org #${sub.orgID}`}
                  </Text>
                  {displayField === 'journal' &&
                    sub.journalStatus &&
                    sub.journalStatus !== 'Open' && (
                      <Badge color="orange" variant="light" size="xs">
                        {sub.journalStatus}
                      </Badge>
                    )}
                </Group>
                <Group gap={4} wrap="nowrap">
                  {onDelete && (
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      color="red"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(sub.submissionID);
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
                  {sub.submissionDate ? dayjs(sub.submissionDate).format('MMM D, YYYY') : 'No date'}
                </Text>
                <ResponseBadge response={sub.responseType} />
                {isActive(sub) ? (
                  <Badge color="green" variant="light" size="xs">
                    Active
                  </Badge>
                ) : (
                  <Badge color="gray" variant="light" size="xs">
                    Closed
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
