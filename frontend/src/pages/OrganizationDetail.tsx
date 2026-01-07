import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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

interface OrganizationDetailProps {
  organizationId: number;
}

export function OrganizationDetail({ organizationId }: OrganizationDetailProps) {
  const navigate = useNavigate();
  const [org, setOrg] = useState<models.Organization | null>(null);
  const [submissions, setSubmissions] = useState<models.SubmissionView[]>([]);
  const [loading, setLoading] = useState(true);

  const {
    notes,
    handleAdd: handleAddNote,
    handleUpdate: handleUpdateNote,
    handleDelete: handleDeleteNote,
  } = useNotes('journal', organizationId);

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const [orgData, subsData] = await Promise.all([
        GetOrganization(organizationId),
        GetSubmissionViewsByOrg(organizationId),
      ]);
      setOrg(orgData);
      setSubmissions(subsData || []);
      SetLastOrgID(organizationId);
    } catch (err) {
      LogErr('Failed to load organization data:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

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
