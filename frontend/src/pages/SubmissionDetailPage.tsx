import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Stack, Grid, Loader, Flex, Text, Paper, SimpleGrid, Title, Card } from '@mantine/core';
import { LogErr } from '@/utils';
import { Group, Badge, Anchor, ActionIcon, Button } from '@mantine/core';
import { IconArrowLeft, IconExternalLink, IconTrash, IconEdit } from '@tabler/icons-react';
import {
  GetSubmission,
  GetWork,
  GetOrganization,
  DeleteSubmission,
  SearchNotesByText,
  DeleteWorkNote,
  DeleteJournalNote,
} from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import { ResponseBadge } from '@/components';
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

export function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<models.Submission | null>(null);
  const [work, setWork] = useState<models.Work | null>(null);
  const [org, setOrg] = useState<models.Organization | null>(null);
  const [workNotes, setWorkNotes] = useState<models.NoteSearchResult[]>([]);
  const [journalNotes, setJournalNotes] = useState<models.NoteSearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  const subId = id ? parseInt(id, 10) : null;

  const loadData = useCallback(async () => {
    if (!subId) return;
    setLoading(true);
    try {
      const subData = await GetSubmission(subId);
      setSubmission(subData);
      if (subData) {
        const [workData, orgData] = await Promise.all([
          GetWork(subData.workID),
          GetOrganization(subData.orgID),
        ]);
        setWork(workData);
        setOrg(orgData);
        const notePromises: Promise<models.NoteSearchResult[]>[] = [];
        if (workData?.title) {
          notePromises.push(SearchNotesByText(workData.title));
        } else {
          notePromises.push(Promise.resolve([]));
        }
        if (orgData?.name) {
          notePromises.push(SearchNotesByText(orgData.name));
        } else {
          notePromises.push(Promise.resolve([]));
        }
        const [workNotesData, journalNotesData] = await Promise.all(notePromises);
        setWorkNotes(workNotesData || []);
        setJournalNotes(journalNotesData || []);
      }
    } catch (err) {
      LogErr('Failed to load submission data:', err);
    } finally {
      setLoading(false);
    }
  }, [subId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = useCallback(async () => {
    if (!subId) return;
    await DeleteSubmission(subId);
    navigate(-1);
  }, [subId, navigate]);

  const handleDeleteNote = useCallback(
    async (note: models.NoteSearchResult, isWorkNote: boolean) => {
      try {
        if (note.entityType === 'work') {
          await DeleteWorkNote(note.noteID);
        } else {
          await DeleteJournalNote(note.noteID);
        }
        if (isWorkNote) {
          setWorkNotes((prev) => prev.filter((n) => n.noteID !== note.noteID));
        } else {
          setJournalNotes((prev) => prev.filter((n) => n.noteID !== note.noteID));
        }
      } catch (err) {
        LogErr('Failed to delete note:', err);
      }
    },
    []
  );

  const handleEditNote = useCallback(
    (note: models.NoteSearchResult) => {
      if (note.entityType === 'work') {
        navigate(`/works/${note.entityID}`);
      } else {
        navigate(`/organizations/${note.entityID}`);
      }
    },
    [navigate]
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
      <Group justify="space-between" align="flex-start">
        <Group>
          <ActionIcon variant="subtle" onClick={() => navigate(-1)}>
            <IconArrowLeft size={20} />
          </ActionIcon>
          <div>
            <Text size="lg" fw={600}>
              Submission #{submission.submissionID}
            </Text>
            <Group gap="xs" mt="xs">
              <ResponseBadge response={submission.responseType} />
              {isActive ? (
                <Badge color="green" variant="light">
                  Active
                </Badge>
              ) : (
                <Badge color="gray" variant="light">
                  Closed
                </Badge>
              )}
              {submission.submissionType && (
                <Badge variant="outline">{submission.submissionType}</Badge>
              )}
            </Group>
          </div>
        </Group>
        <Button
          color="red"
          variant="light"
          size="xs"
          leftSection={<IconTrash size={14} />}
          onClick={handleDelete}
        >
          Delete
        </Button>
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
                <ActionIcon variant="light" onClick={() => navigate(`/works/${work.workID}`)}>
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
                <ActionIcon variant="light" onClick={() => navigate(`/organizations/${org.orgID}`)}>
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
          <Field label="Response Type" value={submission.responseType} />
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
                <Anchor href={submission.webAddress} target="_blank" size="sm">
                  {submission.webAddress}
                </Anchor>
              </div>
            )}
            <Field label="User ID" value={submission.userID} />
          </SimpleGrid>
        </Paper>
      )}

      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" withBorder h="100%">
            <Title order={4} mb="md">
              Notes Mentioning {work?.title}
            </Title>
            {workNotes.length === 0 ? (
              <Text c="dimmed" size="sm" ta="center">
                No notes mentioning this work
              </Text>
            ) : (
              <Stack gap="xs">
                {workNotes.map((note, idx) => (
                  <Card
                    key={`work-${note.entityType}-${note.entityID}-${idx}`}
                    padding="sm"
                    radius="sm"
                    withBorder
                  >
                    <Group justify="space-between" wrap="nowrap" mb="xs">
                      <Group gap="xs">
                        <Badge
                          size="xs"
                          variant="light"
                          color={note.entityType === 'work' ? 'blue' : 'grape'}
                        >
                          {note.entityType === 'work' ? 'Work' : 'Journal'}
                        </Badge>
                        <Text size="sm" fw={500}>
                          {note.entityName}
                        </Text>
                      </Group>
                    </Group>
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                      {note.note}
                    </Text>
                    <Group justify="space-between" mt="xs">
                      <Text size="xs" c="dimmed">
                        {dayjs(note.createdAt).format('MMM D, YYYY')}
                      </Text>
                      <Group gap="xs">
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          color="red"
                          onClick={() => handleDeleteNote(note, true)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={() => handleEditNote(note)}
                        >
                          <IconEdit size={14} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" withBorder h="100%">
            <Title order={4} mb="md">
              Notes Mentioning {org?.name}
            </Title>
            {journalNotes.length === 0 ? (
              <Text c="dimmed" size="sm" ta="center">
                No notes mentioning this journal
              </Text>
            ) : (
              <Stack gap="xs">
                {journalNotes.map((note, idx) => (
                  <Card
                    key={`journal-${note.entityType}-${note.entityID}-${idx}`}
                    padding="sm"
                    radius="sm"
                    withBorder
                  >
                    <Group justify="space-between" wrap="nowrap" mb="xs">
                      <Group gap="xs">
                        <Badge
                          size="xs"
                          variant="light"
                          color={note.entityType === 'work' ? 'blue' : 'grape'}
                        >
                          {note.entityType === 'work' ? 'Work' : 'Journal'}
                        </Badge>
                        <Text size="sm" fw={500}>
                          {note.entityName}
                        </Text>
                      </Group>
                    </Group>
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                      {note.note}
                    </Text>
                    <Group justify="space-between" mt="xs">
                      <Text size="xs" c="dimmed">
                        {dayjs(note.createdAt).format('MMM D, YYYY')}
                      </Text>
                      <Group gap="xs">
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          color="red"
                          onClick={() => handleDeleteNote(note, false)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={() => handleEditNote(note)}
                        >
                          <IconEdit size={14} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
