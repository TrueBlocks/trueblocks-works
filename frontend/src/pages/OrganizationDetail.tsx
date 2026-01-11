import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stack, Grid, Loader, Flex, Text, ActionIcon, Tooltip, Group } from '@mantine/core';
import { IconChevronUp, IconChevronDown, IconTrash, IconRestore, IconX } from '@tabler/icons-react';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { LogErr, showValidationResult } from '@/utils';
import { useNotes } from '@/hooks';
import {
  GetOrganization,
  SetLastOrgID,
  GetSubmissionViewsByOrg,
  DeleteSubmission,
  UpdateOrganization,
  DeleteOrganization,
  UndeleteOrganization,
  GetOrganizationDeleteConfirmation,
  DeleteOrganizationPermanent,
} from '@wailsjs/go/main/App';
import { models, db } from '@wailsjs/go/models';
import {
  OrgHeader,
  OrgDetails,
  NotesPortal,
  SubmissionsPortal,
  ConfirmDeleteModal,
} from '@/components';

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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<db.DeleteConfirmation | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  // Reload on Cmd+R
  useEffect(() => {
    function handleReload() {
      loadData();
    }
    window.addEventListener('reloadCurrentView', handleReload);
    return () => window.removeEventListener('reloadCurrentView', handleReload);
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
        message: 'Delete failed',
        color: 'red',
        autoClose: 5000,
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
        message: 'Restore failed',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, [org, loadData]);

  const handlePermanentDeleteClick = useCallback(async () => {
    if (!org) return;
    try {
      const conf = await GetOrganizationDeleteConfirmation(org.orgID);
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
  }, [org]);

  const handlePermanentDelete = useCallback(async () => {
    if (!org) return;
    setDeleteLoading(true);
    try {
      await DeleteOrganizationPermanent(org.orgID);
      setDeleteModalOpen(false);
      notifications.show({
        message: 'Organization permanently deleted',
        color: 'green',
        autoClose: 3000,
      });
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
      navigate('/organizations');
    } catch (err) {
      LogErr('Failed to permanently delete organization:', err);
      notifications.show({
        message: 'Permanent delete failed',
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setDeleteLoading(false);
    }
  }, [org, navigate]);

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
          const result = await UpdateOrganization(updatedOrg);
          showValidationResult(result);
        }}
        actions={
          org.attributes?.includes('deleted') ? (
            <Group gap={4}>
              <ActionIcon
                size="lg"
                variant="light"
                color="green"
                onClick={handleUndelete}
                aria-label="Restore"
              >
                <IconRestore size={18} />
              </ActionIcon>
              <ActionIcon
                size="lg"
                variant="subtle"
                color="red"
                onClick={handlePermanentDeleteClick}
                aria-label="Remove permanently"
              >
                <IconX size={18} />
              </ActionIcon>
            </Group>
          ) : (
            <ActionIcon
              size="lg"
              variant="light"
              color="red"
              onClick={handleDelete}
              aria-label="Delete"
            >
              <IconTrash size={18} />
            </ActionIcon>
          )
        }
      />

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <OrgDetails
            org={org}
            onUpdate={async (updatedOrg) => {
              setOrg(updatedOrg);
              const result = await UpdateOrganization(updatedOrg);
              showValidationResult(result);
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
