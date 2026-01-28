import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  GetDistinctValues,
} from '@app';
import { BrowserOpenURL } from '@wailsjs/runtime/runtime';
import { models, db } from '@models';
import { NotesPortal } from '@/portals';
import { ConfirmDeleteModal } from '@/modals';
import { DetailHeader, EditableField, EntityFieldSelect } from '@trueblocks/ui';
import { useNotes } from '@/hooks';
import { useNavigation } from '@trueblocks/scaffold';
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
  filteredSubmissions?: models.SubmissionView[];
}

export function SubmissionDetail({ submissionId, filteredSubmissions }: SubmissionDetailProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const returnToRef = useRef<string | undefined>(
    (location.state as { returnTo?: string } | null)?.returnTo
  );
  const navigation = useNavigation();
  const { hasPrev, hasNext, currentIndex, currentLevel } = navigation;
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

  // If stack is empty and we have filteredSubmissions (e.g., on app restart), populate from list
  useEffect(() => {
    if (navigation.stack.length === 0 && filteredSubmissions && filteredSubmissions.length > 0) {
      const items = filteredSubmissions.map((s) => ({ id: s.submissionID }));
      navigation.setItems('submission', items, submissionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSubmissions, navigation.stack.length]);

  const updateSubmissionField = useCallback(async (s: models.Submission) => {
    const result = await UpdateSubmission(s);
    if (showValidationResult(result)) return { hasErrors: true };
  }, []);

  const loadResponseTypeOptions = useMemo(
    () => () => GetDistinctValues('Submissions', 'response_type').then((v) => v || []),
    []
  );
  const loadSubmissionTypeOptions = useMemo(
    () => () => GetDistinctValues('Submissions', 'submission_type').then((v) => v || []),
    []
  );

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

  const navigateToSubmission = useCallback(
    (id: number) => {
      navigate(`/submissions/${id}`);
    },
    [navigate]
  );

  const handlePrev = useCallback(() => {
    if (hasPrev && currentLevel) {
      const idx = navigation.currentIndex;
      const prevItem = currentLevel.items[idx - 1] as { id: number } | undefined;
      if (prevItem) {
        navigation.setCurrentId(prevItem.id);
        navigateToSubmission(prevItem.id);
      }
    }
  }, [hasPrev, currentLevel, navigation, navigateToSubmission]);

  const handleNext = useCallback(() => {
    if (hasNext && currentLevel) {
      const idx = navigation.currentIndex;
      const nextItem = currentLevel.items[idx + 1] as { id: number } | undefined;
      if (nextItem) {
        navigation.setCurrentId(nextItem.id);
        navigateToSubmission(nextItem.id);
      }
    }
  }, [hasNext, currentLevel, navigation, navigateToSubmission]);

  const handleHome = useCallback(() => {
    if (currentLevel && currentLevel.items.length > 0) {
      const firstItem = currentLevel.items[0] as { id: number } | undefined;
      if (firstItem) {
        navigation.setCurrentId(firstItem.id);
        navigateToSubmission(firstItem.id);
      }
    }
  }, [currentLevel, navigation, navigateToSubmission]);

  const handleEnd = useCallback(() => {
    if (currentLevel && currentLevel.items.length > 0) {
      const lastItem = currentLevel.items[currentLevel.items.length - 1] as
        | { id: number }
        | undefined;
      if (lastItem) {
        navigation.setCurrentId(lastItem.id);
        navigateToSubmission(lastItem.id);
      }
    }
  }, [currentLevel, navigation, navigateToSubmission]);

  const handleReturnToList = useCallback(() => {
    if (returnToRef.current) {
      navigate(returnToRef.current);
    } else {
      navigate('/submissions', { state: { selectID: submissionId } });
    }
  }, [navigate, submissionId]);

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
        totalCount={currentLevel?.items.length ?? 0}
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
            <EntityFieldSelect
              entity={submission}
              field="responseType"
              loadOptions={loadResponseTypeOptions}
              updateEntity={updateSubmissionField}
              width={100}
              onUpdate={setSubmission}
              onError={(err, field) => LogErr(`Failed to update ${field}:`, err)}
            />
            <EntityFieldSelect
              entity={submission}
              field="submissionType"
              loadOptions={loadSubmissionTypeOptions}
              updateEntity={updateSubmissionField}
              width={100}
              onUpdate={setSubmission}
              onError={(err, field) => LogErr(`Failed to update ${field}:`, err)}
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
