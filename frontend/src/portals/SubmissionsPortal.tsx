import { Paper, Title, Text, Group, ActionIcon, Badge, Stack, Card, Tooltip } from '@mantine/core';
import { IconPlus, IconExternalLink, IconTrash, IconRestore, IconX } from '@tabler/icons-react';
import { models } from '@models';
import { ResponseBadge } from '@/components';
import dayjs from 'dayjs';

interface SubmissionsPortalProps {
  submissions: models.SubmissionView[];
  onAdd?: () => void;
  onRowClick?: (sub: models.SubmissionView) => void;
  onWorkClick?: (workId: number) => void;
  onCollectionClick?: (collId: number) => void;
  onOrgClick?: (orgId: number) => void;
  onDelete?: (subId: number) => void;
  onUndelete?: (subId: number) => void;
  onPermanentDelete?: (subId: number) => void;
  displayField?: 'journal' | 'work';
}

function isActive(sub: models.SubmissionView): boolean {
  return sub.decisionPending === 'yes';
}

export function SubmissionsPortal({
  submissions,
  onAdd,
  onRowClick,
  onWorkClick,
  onCollectionClick,
  onOrgClick,
  onDelete,
  onUndelete,
  onPermanentDelete,
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
              style={{
                opacity: sub.isDeleted ? 0.6 : 1,
              }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    fw={500}
                    size="sm"
                    lineClamp={1}
                    td={sub.isDeleted ? 'line-through' : undefined}
                    c={
                      displayField === 'work' &&
                      (sub.isCollection ? onCollectionClick : onWorkClick)
                        ? 'blue'
                        : displayField === 'journal' && onOrgClick
                          ? 'blue'
                          : undefined
                    }
                    style={{
                      cursor:
                        (displayField === 'work' &&
                          (sub.isCollection ? onCollectionClick : onWorkClick)) ||
                        (displayField === 'journal' && onOrgClick)
                          ? 'pointer'
                          : 'default',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (displayField === 'work') {
                        if (sub.isCollection && onCollectionClick) {
                          onCollectionClick(sub.workID);
                        } else if (onWorkClick) {
                          onWorkClick(sub.workID);
                        }
                      } else if (displayField === 'journal' && onOrgClick) {
                        onOrgClick(sub.orgID);
                      }
                    }}
                  >
                    {displayField === 'work'
                      ? sub.titleOfWork ||
                        (sub.isCollection ? `Collection #${sub.workID}` : `Work #${sub.workID}`)
                      : sub.journalName || `Org #${sub.orgID}`}
                  </Text>
                  {displayField === 'work' && sub.isCollection && (
                    <Badge color="violet" variant="light" size="xs">
                      collection
                    </Badge>
                  )}
                  {displayField === 'journal' &&
                    sub.journalStatus &&
                    sub.journalStatus !== 'Open' && (
                      <Badge color="orange" variant="light" size="xs">
                        {sub.journalStatus}
                      </Badge>
                    )}
                </Group>
                <Group gap={4} wrap="nowrap">
                  {sub.isDeleted ? (
                    <>
                      {onUndelete && (
                        <Tooltip label="Restore">
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            color="green"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUndelete(sub.submissionID);
                            }}
                          >
                            <IconRestore size={14} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      {onPermanentDelete && (
                        <Tooltip label="Remove permanently">
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            color="red"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPermanentDelete(sub.submissionID);
                            }}
                          >
                            <IconX size={14} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </>
                  ) : (
                    onDelete && (
                      <Tooltip label="Delete submission">
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
                      </Tooltip>
                    )
                  )}
                  {onRowClick && (
                    <Tooltip label="View submission">
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        color="blue"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRowClick(sub);
                        }}
                      >
                        <IconExternalLink size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
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
