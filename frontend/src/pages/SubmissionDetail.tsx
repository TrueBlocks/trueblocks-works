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
} from '@mantine/core';
import { IconExternalLink, IconSend } from '@tabler/icons-react';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { LogErr, showValidationResult } from '@/utils';
import {
  GetSubmission,
  GetWork,
  GetOrganization,
  DeleteSubmission,
  UndeleteSubmission,
  GetSubmissionDeleteConfirmation,
  DeleteSubmissionPermanent,
  SetLastSubmissionID,
  UpdateSubmission,
} from '@app';
import { BrowserOpenURL } from '@wailsjs/runtime/runtime';
import { models, db } from '@models';
import {
  DetailHeader,
  SubmissionFieldSelect,
  ConfirmDeleteModal,
  NotesPortal,
  EditableField,
} from '@/components';
import { useNotes } from '@/hooks';
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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<db.DeleteConfirmation | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const {
    notes,
    handleAdd: handleAddNote,
    handleUpdate: handleUpdateNote,
    handleDelete: handleDeleteNote,
    handleUndelete: handleUndeleteNote,
    handlePermanentDelete: handlePermanentDeleteNote,
  } = useNotes('submission', submissionId);

  const loadData = useCallback(async () => {
    if (!submissionId) return;
    setLoading(true);
    try {
      const subData = await GetSubmission(submissionId);
      setSubmission(subData);
      SetLastSubmissionID(submissionId);
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
      'ArrowRight',
      (e) => {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        if (!isInput) {
          handleNext();
        }
      },
      { preventDefault: false },
    ],
    [
      'ArrowLeft',
      (e) => {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        if (!isInput) {
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

  const handlePermanentDeleteClick = useCallback(async () => {
    if (!submission) return;
    try {
      const conf = await GetSubmissionDeleteConfirmation(submission.submissionID);
      setDeleteConfirmation(conf);
      setDeleteModalOpen(true);
    } catch (err) {
      LogErr('Failed to get delete confirmation:', err);
      notifications.show({
        message: 'Failed to prepare delete',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, [submission]);

  const handlePermanentDelete = useCallback(async () => {
    if (!submission) return;
    setDeleteLoading(true);
    try {
      await DeleteSubmissionPermanent(submission.submissionID);
      setDeleteModalOpen(false);
      notifications.show({
        message: 'Submission permanently deleted',
        color: 'green',
        autoClose: 3000,
      });
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
      navigate('/submissions');
    } catch (err) {
      LogErr('Failed to permanently delete submission:', err);
      notifications.show({
        message: 'Permanent delete failed',
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setDeleteLoading(false);
    }
  }, [submission, navigate]);

  const handleFieldUpdate = useCallback(
    async (field: 'webAddress' | 'userID', value: string) => {
      if (!submission) return;
      const updated = { ...submission, [field]: value || null };
      try {
        const result = await UpdateSubmission(updated as models.Submission);
        if (!showValidationResult(result)) {
          setSubmission(updated as models.Submission);
        }
      } catch (err) {
        LogErr(`Failed to update ${field}:`, err);
      }
    },
    [submission]
  );

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
      <DetailHeader
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={handlePrev}
        onNext={handleNext}
        onBack={handleReturnToList}
        currentIndex={currentIndex}
        totalCount={filteredSubmissions.length}
        icon={<IconSend size={24} />}
        title={
          <Group gap="xs" align="baseline">
            <Text size="xl">Submission</Text>
            <Text c="dark.3" size="md">
              (#{submission.submissionID})
            </Text>
          </Group>
        }
        subtitle={
          <Group gap="xs">
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
        }
        actionsRight={
          isActive ? (
            <Badge color="green" variant="light" size="lg">
              Active
            </Badge>
          ) : (
            <Badge color="gray" variant="light" size="lg">
              Closed
            </Badge>
          )
        }
        isDeleted={submission.attributes?.includes('deleted')}
        onDelete={handleDelete}
        onUndelete={handleUndelete}
        onPermanentDelete={handlePermanentDeleteClick}
      />

      <Grid>
        <Grid.Col span={{ base: 12, md: 9 }}>
          <Stack gap="md">
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
                          navigate(`/organizations/${org.orgID}`, {
                            state: { selectID: org.orgID },
                          })
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
                    submission.queryDate
                      ? dayjs(submission.queryDate).format('MMM D, YYYY')
                      : undefined
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

            <Paper p="md" withBorder>
              <Text size="sm" fw={600} mb="md">
                Submission Portal
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={500} mb={4}>
                    Website
                  </Text>
                  <Group gap="xs">
                    <EditableField
                      value={submission.webAddress || ''}
                      onChange={(val) => handleFieldUpdate('webAddress', val)}
                      placeholder="Enter URL..."
                    />
                    {submission.webAddress && (
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={() => BrowserOpenURL(submission.webAddress!)}
                      >
                        <IconExternalLink size={14} />
                      </ActionIcon>
                    )}
                  </Group>
                </div>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={500} mb={4}>
                    User ID
                  </Text>
                  <EditableField
                    value={submission.userID || ''}
                    onChange={(val) => handleFieldUpdate('userID', val)}
                    placeholder="Enter user ID..."
                  />
                </div>
              </SimpleGrid>
            </Paper>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <NotesPortal
            notes={notes}
            onAdd={handleAddNote}
            onUpdate={handleUpdateNote}
            onDelete={handleDeleteNote}
            onUndelete={handleUndeleteNote}
            onPermanentDelete={handlePermanentDeleteNote}
          />
        </Grid.Col>
      </Grid>

      <ConfirmDeleteModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handlePermanentDelete}
        confirmation={deleteConfirmation}
        loading={deleteLoading}
      />
    </Stack>
  );
}
