import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Stack, Grid, Loader, Flex, Text } from '@mantine/core';
import { LogErr } from '@/utils';
import { useNotes } from '@/hooks';
import {
  GetOrganization,
  SetLastOrgID,
  GetSubmissionViewsByOrg,
  DeleteSubmission,
  UpdateOrganization,
} from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import { OrgHeader, OrgDetails, NotesPortal, SubmissionsPortal } from '@/components';

export function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [org, setOrg] = useState<models.Organization | null>(null);
  const [submissions, setSubmissions] = useState<models.SubmissionView[]>([]);
  const [loading, setLoading] = useState(true);

  const orgId = id ? parseInt(id, 10) : null;
  const {
    notes,
    handleAdd: handleAddNote,
    handleUpdate: handleUpdateNote,
    handleDelete: handleDeleteNote,
  } = useNotes('journal', orgId);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [orgData, subsData] = await Promise.all([
        GetOrganization(orgId),
        GetSubmissionViewsByOrg(orgId),
      ]);
      setOrg(orgData);
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

  const handleDeleteSubmission = useCallback(async (subId: number) => {
    await DeleteSubmission(subId);
    setSubmissions((prev) => prev.filter((s) => s.submissionID !== subId));
  }, []);

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
      <OrgHeader
        org={org}
        onOrgUpdate={(updated) => setOrg(updated)}
        onNameChange={async (newName) => {
          const updatedOrg = { ...org, name: newName } as models.Organization;
          setOrg(updatedOrg);
          await UpdateOrganization(updatedOrg);
        }}
      />

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <OrgDetails
            org={org}
            onUpdate={async (updatedOrg) => {
              setOrg(updatedOrg);
              await UpdateOrganization(updatedOrg);
            }}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md">
            <NotesPortal
              title="Journal Notes"
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
