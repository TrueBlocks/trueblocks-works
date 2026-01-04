import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Stack, Grid, Loader, Flex, Text } from '@mantine/core';
import { LogErr } from '@/utils';
import {
  GetOrganization,
  GetJournalNotes,
  CreateJournalNote,
  UpdateJournalNote,
  DeleteJournalNote,
  SetLastOrgID,
  GetSubmissionViewsByOrg,
  DeleteSubmission,
} from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import { OrgHeader, OrgDetails, JournalNotesPortal, SubmissionsPortal } from '@/components';

export function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [org, setOrg] = useState<models.Organization | null>(null);
  const [notes, setNotes] = useState<models.JournalNote[]>([]);
  const [submissions, setSubmissions] = useState<models.SubmissionView[]>([]);
  const [loading, setLoading] = useState(true);

  const orgId = id ? parseInt(id, 10) : null;

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [orgData, notesData, subsData] = await Promise.all([
        GetOrganization(orgId),
        GetJournalNotes(orgId),
        GetSubmissionViewsByOrg(orgId),
      ]);
      setOrg(orgData);
      setNotes(notesData || []);
      setSubmissions(subsData || []);
      SetLastOrgID(orgId);
    } catch (err) {
      LogErr('Failed to load organization data:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteSubmission = useCallback(
    async (subId: number) => {
      await DeleteSubmission(subId);
      setSubmissions((prev) => prev.filter((s) => s.submissionID !== subId));
    },
    []
  );

  const handleAddNote = useCallback(
    async (noteText: string) => {
      if (!orgId) return;
      const note = new models.JournalNote();
      note.orgID = orgId;
      note.note = noteText;
      await CreateJournalNote(note);
      const updated = await GetJournalNotes(orgId);
      setNotes(updated || []);
    },
    [orgId]
  );

  const handleUpdateNote = useCallback(
    async (note: models.JournalNote) => {
      await UpdateJournalNote(note);
      if (orgId) {
        const updated = await GetJournalNotes(orgId);
        setNotes(updated || []);
      }
    },
    [orgId]
  );

  const handleDeleteNote = useCallback(
    async (noteId: number) => {
      await DeleteJournalNote(noteId);
      if (orgId) {
        const updated = await GetJournalNotes(orgId);
        setNotes(updated || []);
      }
    },
    [orgId]
  );

  if (loading) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  if (!org) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Text c="dimmed">Organization not found</Text>
      </Flex>
    );
  }

  return (
    <Stack gap="lg">
      <OrgHeader org={org} onStatusChange={(newStatus) => setOrg({ ...org, status: newStatus })} />

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <OrgDetails org={org} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md">
            <JournalNotesPortal
              notes={notes}
              onAdd={handleAddNote}
              onUpdate={handleUpdateNote}
              onDelete={handleDeleteNote}
            />
            <SubmissionsPortal
              submissions={submissions}
              onRowClick={(sub) => navigate(`/submissions/${sub.submissionID}`)}
              onDelete={handleDeleteSubmission}
              displayField="work"
            />
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
