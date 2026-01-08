import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stack, Grid, Loader, Flex, Text, ActionIcon, Tooltip, Group, Button } from '@mantine/core';
import { IconChevronUp, IconChevronDown, IconTrash, IconRestore } from '@tabler/icons-react';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { LogErr } from '@/utils';
import { useNotes } from '@/hooks';
import {
  GetOrganization,
  SetLastOrgID,
  GetSubmissionViewsByOrg,
  DeleteSubmission,
  UpdateOrganization,
  DeleteOrganization,
  UndeleteOrganization,
} from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import { OrgHeader, OrgDetails, NotesPortal, SubmissionsPortal } from '@/components';

interface OrganizationDetailProps {
  organizationId: number;
  filteredOrganizations: models.OrganizationWithNotes[];
}

export function OrganizationDetail({
  organizationId,
  filteredOrganizations,
}: OrganizationDetailProps) {
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
  const currentIndex = filteredOrganizations.findIndex((o) => o.orgID === organizationId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < filteredOrganizations.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      const prevOrg = filteredOrganizations[currentIndex - 1];
      navigate(`/organizations/${prevOrg.orgID}`);
    }
  }, [hasPrev, filteredOrganizations, currentIndex, navigate]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      const nextOrg = filteredOrganizations[currentIndex + 1];
      navigate(`/organizations/${nextOrg.orgID}`);
    }
  }, [hasNext, filteredOrganizations, currentIndex, navigate]);

  const handleHome = useCallback(() => {
    if (filteredOrganizations.length > 0 && currentIndex !== 0) {
      navigate(`/organizations/${filteredOrganizations[0].orgID}`);
    }
  }, [filteredOrganizations, currentIndex, navigate]);

  const handleEnd = useCallback(() => {
    if (filteredOrganizations.length > 0 && currentIndex !== filteredOrganizations.length - 1) {
      navigate(`/organizations/${filteredOrganizations[filteredOrganizations.length - 1].orgID}`);
    }
  }, [filteredOrganizations, currentIndex, navigate]);

  const handleReturnToList = useCallback(() => {
    navigate('/organizations', { replace: true });
  }, [navigate]);

  useHotkeys([
    ['ArrowDown', handleNext],
    ['ArrowUp', handlePrev],
    ['ArrowRight', handleNext],
    ['ArrowLeft', handlePrev],
    ['Home', handleHome],
    ['End', handleEnd],
    ['mod+shift+ArrowLeft', handleReturnToList],
    ['mod+shift+ArrowUp', handleReturnToList],
  ]);
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

  const handleDelete = useCallback(async () => {
    if (!org) return;
    try {
      await DeleteOrganization(org.orgID);
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
      loadData();
    } catch (err) {
      LogErr('Failed to delete organization:', err);
      notifications.show({
        title: 'Delete Failed',
        message: 'Could not delete organization',
        color: 'red',
      });
    }
  }, [org, loadData]);

  const handleUndelete = useCallback(async () => {
    if (!org) return;
    try {
      await UndeleteOrganization(org.orgID);
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
      loadData();
    } catch (err) {
      LogErr('Failed to restore organization:', err);
      notifications.show({
        title: 'Restore Failed',
        message: 'Could not restore organization',
        color: 'red',
      });
    }
  }, [org, loadData]);

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
      <Group gap="xs">
        <Tooltip label="Previous organization (↑)">
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={handlePrev}
            disabled={!hasPrev}
            aria-label="Previous organization"
          >
            <IconChevronUp />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Next organization (↓)">
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={handleNext}
            disabled={!hasNext}
            aria-label="Next organization"
          >
            <IconChevronDown />
          </ActionIcon>
        </Tooltip>
      </Group>
      <OrgHeader
        org={org}
        onOrgUpdate={(updated) => setOrg(updated)}
        onNameChange={async (newName) => {
          const updatedOrg = { ...org, name: newName } as models.Organization;
          setOrg(updatedOrg);
          await UpdateOrganization(updatedOrg);
        }}
        actions={
          org.attributes?.includes('deleted') ? (
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
          )
        }
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
              onRowClick={(sub) =>
                navigate(`/submissions/${sub.submissionID}`, {
                  state: { selectID: sub.submissionID },
                })
              }
              onDelete={handleDeleteSubmission}
              displayField="work"
            />
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
