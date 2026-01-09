import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack,
  Grid,
  Loader,
  Flex,
  Text,
  Paper,
  SimpleGrid,
  Group,
  Badge,
  ActionIcon,
  Button,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconExternalLink,
  IconTrash,
  IconChevronUp,
  IconChevronDown,
  IconRestore,
} from '@tabler/icons-react';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { LogErr } from '@/utils';
import {
  GetSubmission,
  GetWork,
  GetOrganization,
  DeleteSubmission,
  UndeleteSubmission,
} from '@wailsjs/go/main/App';
import { BrowserOpenURL } from '@wailsjs/runtime/runtime';
import { models } from '@wailsjs/go/models';
import { SubmissionFieldSelect } from '@/components';
import dayjs from 'dayjs';

function Field({ label, value }: { label: string; value?: string | number }) {
  if (!value) return null;
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </div>
  );
}

interface SubmissionDetailProps {
  submissionId: number;
  filteredSubmissions: models.SubmissionView[];
}

export function SubmissionDetail({ submissionId, filteredSubmissions }: SubmissionDetailProps) {
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<models.Submission | null>(null);
  const [work, setWork] = useState<models.Work | null>(null);
  const [org, setOrg] = useState<models.Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!submissionId) return;
    setLoading(true);
    try {
      const subData = await GetSubmission(submissionId);
      setSubmission(subData);
      if (subData) {
        const [workData, orgData] = await Promise.all([
          GetWork(subData.workID),
          GetOrganization(subData.orgID),
        ]);
        setWork(workData);
        setOrg(orgData);
      }
    } catch (err) {
      LogErr('Failed to load submission data:', err);
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload on Cmd+R
  useEffect(() => {
    function handleReload() {
      loadData();
    }
    window.addEventListener('reloadCurrentView', handleReload);
    return () => window.removeEventListener('reloadCurrentView', handleReload);
  }, [loadData]);

  const currentIndex = filteredSubmissions.findIndex((s) => s.submissionID === submissionId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < filteredSubmissions.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      const prevSub = filteredSubmissions[currentIndex - 1];
      navigate(`/submissions/${prevSub.submissionID}`);
    }
  }, [hasPrev, filteredSubmissions, currentIndex, navigate]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      const nextSub = filteredSubmissions[currentIndex + 1];
      navigate(`/submissions/${nextSub.submissionID}`);
    }
  }, [hasNext, filteredSubmissions, currentIndex, navigate]);

  const handleHome = useCallback(() => {
    if (filteredSubmissions.length > 0 && currentIndex !== 0) {
      navigate(`/submissions/${filteredSubmissions[0].submissionID}`);
    }
  }, [filteredSubmissions, currentIndex, navigate]);

  const handleEnd = useCallback(() => {
    if (filteredSubmissions.length > 0 && currentIndex !== filteredSubmissions.length - 1) {
      navigate(`/submissions/${filteredSubmissions[filteredSubmissions.length - 1].submissionID}`);
    }
  }, [filteredSubmissions, currentIndex, navigate]);

  const handleReturnToList = useCallback(() => {
    navigate('/submissions', { replace: true });
  }, [navigate]);

  useHotkeys([
    [
      'ArrowDown',
      (e) => {
        const target = e.target as HTMLElement;
        const isInTable = target.closest('table, [role="grid"], .mantine-ScrollArea-viewport');
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        if (!isInTable && !isInput) {
          handleNext();
        }
      },
      { preventDefault: false },
    ],
    [
      'ArrowUp',
      (e) => {
        const target = e.target as HTMLElement;
        const isInTable = target.closest('table, [role="grid"], .mantine-ScrollArea-viewport');
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        if (!isInTable && !isInput) {
          handlePrev();
        }
      },
      { preventDefault: false },
    ],
    [
      'ArrowRight',
      (e) => {
        const target = e.target as HTMLElement;
        const isInTable = target.closest('table, [role="grid"], .mantine-ScrollArea-viewport');
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        if (!isInTable && !isInput) {
          handleNext();
        }
      },
      { preventDefault: false },
    ],
    [
      'ArrowLeft',
      (e) => {
        const target = e.target as HTMLElement;
        const isInTable = target.closest('table, [role="grid"], .mantine-ScrollArea-viewport');
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        if (!isInTable && !isInput) {
          handlePrev();
        }
      },
      { preventDefault: false },
    ],
    ['Home', handleHome],
    ['End', handleEnd],
    ['mod+shift+ArrowLeft', handleReturnToList],
    ['mod+shift+ArrowUp', handleReturnToList],
  ]);

  const handleDelete = useCallback(async () => {
    if (!submission) return;
    try {
      await DeleteSubmission(submission.submissionID);
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
      loadData();
    } catch (err) {
      LogErr('Failed to delete submission:', err);
      notifications.show({
        message: 'Delete failed',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, [submission, loadData]);

  const handleUndelete = useCallback(async () => {
    if (!submission) return;
    try {
      await UndeleteSubmission(submission.submissionID);
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
      loadData();
    } catch (err) {
      LogErr('Failed to restore submission:', err);
      notifications.show({
        message: 'Restore failed',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, [submission, loadData]);

  if (loading) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  if (!submission) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Text c="dimmed">Submission not found</Text>
      </Flex>
    );
  }

  const isActive = !submission.responseDate && !submission.responseType;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Group>
          <ActionIcon variant="subtle" onClick={() => navigate('/submissions')}>
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Tooltip label="Previous submission (↑)">
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={handlePrev}
              disabled={!hasPrev}
              aria-label="Previous submission"
            >
              <IconChevronUp />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Next submission (↓)">
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={handleNext}
              disabled={!hasNext}
              aria-label="Next submission"
            >
              <IconChevronDown />
            </ActionIcon>
          </Tooltip>
          <div>
            <Text size="lg" fw={600}>
              Submission #{submission.submissionID}
            </Text>
            <Group gap="xs" mt="xs">
              <SubmissionFieldSelect
                submission={submission}
                field="responseType"
                width={100}
                onUpdate={setSubmission}
              />
              <SubmissionFieldSelect
                submission={submission}
                field="submissionType"
                width={100}
                onUpdate={setSubmission}
              />
            </Group>
          </div>
        </Group>
        <Group>
          {isActive ? (
            <Badge color="green" variant="light" size="lg">
              Active
            </Badge>
          ) : (
            <Badge color="gray" variant="light" size="lg">
              Closed
            </Badge>
          )}
          {submission.attributes?.includes('deleted') ? (
            <Button
              size="xs"
              variant="light"
              color="green"
              leftSection={<IconRestore size={14} />}
              onClick={handleUndelete}
            >
              Restore
            </Button>
          ) : (
            <Button
              size="xs"
              variant="light"
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={handleDelete}
            >
              Delete
            </Button>
          )}
        </Group>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" withBorder>
            <Text size="sm" fw={600} mb="md">
              Work
            </Text>
            {work ? (
              <Group justify="space-between">
                <div>
                  <Text fw={500}>{work.title}</Text>
                  <Text size="sm" c="dimmed">
                    {work.type}
                  </Text>
                </div>
                <ActionIcon
                  variant="light"
                  onClick={() =>
                    navigate(`/works/${work.workID}`, { state: { selectID: work.workID } })
                  }
                >
                  <IconExternalLink size={16} />
                </ActionIcon>
              </Group>
            ) : (
              <Text c="dimmed">Work #{submission.workID}</Text>
            )}
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" withBorder>
            <Text size="sm" fw={600} mb="md">
              Organization
            </Text>
            {org ? (
              <Group justify="space-between">
                <div>
                  <Text fw={500}>{org.name}</Text>
                  <Text size="sm" c="dimmed">
                    {org.type}
                  </Text>
                </div>
                <ActionIcon
                  variant="light"
                  onClick={() =>
                    navigate(`/organizations/${org.orgID}`, { state: { selectID: org.orgID } })
                  }
                >
                  <IconExternalLink size={16} />
                </ActionIcon>
              </Group>
            ) : (
              <Text c="dimmed">Organization #{submission.orgID}</Text>
            )}
          </Paper>
        </Grid.Col>
      </Grid>

      <Paper p="md" withBorder>
        <Text size="sm" fw={600} mb="md">
          Submission Details
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          <Field label="Draft" value={submission.draft} />
          <Field
            label="Submission Date"
            value={
              submission.submissionDate
                ? dayjs(submission.submissionDate).format('MMM D, YYYY')
                : undefined
            }
          />
          <Field
            label="Query Date"
            value={
              submission.queryDate ? dayjs(submission.queryDate).format('MMM D, YYYY') : undefined
            }
          />
          <Field
            label="Response Date"
            value={
              submission.responseDate
                ? dayjs(submission.responseDate).format('MMM D, YYYY')
                : undefined
            }
          />
          <Field label="Contest Name" value={submission.contestName} />
          <Field label="Cost" value={submission.cost ? `$${submission.cost}` : undefined} />
        </SimpleGrid>
      </Paper>

      {(submission.webAddress || submission.userID) && (
        <Paper p="md" withBorder>
          <Text size="sm" fw={600} mb="md">
            Submission Portal
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {submission.webAddress && (
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                  Website
                </Text>
                <Text
                  size="sm"
                  c="blue"
                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => BrowserOpenURL(submission.webAddress!)}
                >
                  {submission.webAddress}
                </Text>
              </div>
            )}
            <Field label="User ID" value={submission.userID} />
          </SimpleGrid>
        </Paper>
      )}
    </Stack>
  );
}
