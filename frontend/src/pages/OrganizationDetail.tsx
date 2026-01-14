import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stack, Grid, Loader, Flex, Text, Group, Badge, Button, Tooltip } from '@mantine/core';
import { IconExternalLink, IconBuilding } from '@tabler/icons-react';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { LogErr, showValidationResult } from '@/utils';
import { useNotes } from '@/hooks';
import {
  GetOrganization,
  SetLastOrgID,
  GetSubmissionViewsByOrg,
  DeleteSubmission,
  UndeleteSubmission,
  GetSubmissionDeleteConfirmation,
  DeleteSubmissionPermanent,
  UpdateOrganization,
  DeleteOrganization,
  UndeleteOrganization,
  GetOrganizationDeleteConfirmation,
  DeleteOrganizationPermanent,
  OpenOrgURL,
  OpenOrgOtherURL,
  OpenDuotrope,
} from '@app';
import { models, db } from '@models';
import {
  DetailHeader,
  OrgDetails,
  NotesPortal,
  SubmissionsPortal,
  ConfirmDeleteModal,
  EditableField,
  OrgFieldSelect,
} from '@/components';
import { orgStatusColors } from '@/types';

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
  const [subDeleteModalOpen, setSubDeleteModalOpen] = useState(false);
  const [subDeleteConfirmation, setSubDeleteConfirmation] = useState<db.DeleteConfirmation | null>(
    null
  );
  const [subDeleteLoading, setSubDeleteLoading] = useState(false);
  const [deletingSubID, setDeletingSubID] = useState<number | null>(null);

  const {
    notes,
    handleAdd: handleAddNote,
    handleUpdate: handleUpdateNote,
    handleDelete: handleDeleteNote,
    handleUndelete: handleUndeleteNote,
    handlePermanentDelete: handlePermanentDeleteNote,
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

  const handleDeleteSubmission = useCallback(
    async (subId: number) => {
      await DeleteSubmission(subId);
      const updated = await GetSubmissionViewsByOrg(organizationId);
      setSubmissions(updated || []);
    },
    [organizationId]
  );

  const handleUndeleteSubmission = useCallback(
    async (subId: number) => {
      await UndeleteSubmission(subId);
      const updated = await GetSubmissionViewsByOrg(organizationId);
      setSubmissions(updated || []);
    },
    [organizationId]
  );

  const handlePermanentDeleteSubmissionClick = useCallback(async (subId: number) => {
    try {
      const conf = await GetSubmissionDeleteConfirmation(subId);
      setSubDeleteConfirmation(conf);
      setDeletingSubID(subId);
      setSubDeleteModalOpen(true);
    } catch (err) {
      LogErr('Failed to get delete confirmation:', err);
    }
  }, []);

  const handlePermanentDeleteSubmission = useCallback(async () => {
    if (!deletingSubID) return;
    setSubDeleteLoading(true);
    try {
      await DeleteSubmissionPermanent(deletingSubID);
      setSubDeleteModalOpen(false);
      setDeletingSubID(null);
      const updated = await GetSubmissionViewsByOrg(organizationId);
      setSubmissions(updated || []);
    } catch (err) {
      LogErr('Failed to permanently delete submission:', err);
    } finally {
      setSubDeleteLoading(false);
    }
  }, [deletingSubID, organizationId]);

  const handleNameChange = useCallback(
    async (newName: string) => {
      if (!org) return;
      const updatedOrg = { ...org, name: newName } as models.Organization;
      setOrg(updatedOrg);
      const result = await UpdateOrganization(updatedOrg);
      showValidationResult(result);
    },
    [org]
  );

  const handleOrgUpdate = useCallback(async (updatedOrg: models.Organization) => {
    setOrg(updatedOrg);
    const result = await UpdateOrganization(updatedOrg);
    showValidationResult(result);
  }, []);

  const handleOpenURL = useCallback(() => {
    if (org) OpenOrgURL(org.orgID);
  }, [org]);

  const handleOpenOtherURL = useCallback(() => {
    if (org) OpenOrgOtherURL(org.orgID);
  }, [org]);

  const handleOpenDuotrope = useCallback(() => {
    if (org) OpenDuotrope(org.orgID);
  }, [org]);

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
      <DetailHeader
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={handlePrev}
        onNext={handleNext}
        onBack={handleReturnToList}
        currentIndex={currentIndex}
        totalCount={filteredOrganizations.length}
        icon={<IconBuilding size={24} />}
        title={
          <Group gap="xs" align="baseline">
            <EditableField
              value={org.name || ''}
              onChange={handleNameChange}
              placeholder="Organization name"
              size="xl"
            />
            <Text c="dark.3" size="md">
              (#{org.orgID})
            </Text>
            {org.otherName && (
              <Text size="sm" c="dimmed">
                {org.otherName}
              </Text>
            )}
          </Group>
        }
        subtitle={
          <>
            <OrgFieldSelect org={org} field="type" onUpdate={handleOrgUpdate} width={100} />
            <OrgFieldSelect
              org={org}
              field="status"
              colorMap={orgStatusColors}
              onUpdate={handleOrgUpdate}
              width={100}
            />
            {org.timing && <Badge variant="outline">{org.timing}</Badge>}
            {org.ranking && (
              <Badge color="yellow" variant="light">
                Ranking: {org.ranking}
              </Badge>
            )}
          </>
        }
        actionsLeft={
          <Group gap="xs">
            {org.url && (
              <Tooltip label={org.url}>
                <Button
                  size="xs"
                  variant="light"
                  color="grape"
                  leftSection={<IconExternalLink size={14} />}
                  onClick={handleOpenURL}
                >
                  Website
                </Button>
              </Tooltip>
            )}
            {org.otherURL && (
              <Tooltip label={org.otherURL}>
                <Button
                  size="xs"
                  variant="light"
                  color="grape"
                  leftSection={<IconExternalLink size={14} />}
                  onClick={handleOpenOtherURL}
                >
                  Other
                </Button>
              </Tooltip>
            )}
            {org.duotropeNum && org.duotropeNum > 0 && (
              <Button
                size="xs"
                variant="light"
                color="grape"
                leftSection={<IconExternalLink size={14} />}
                onClick={handleOpenDuotrope}
              >
                Duotrope
              </Button>
            )}
          </Group>
        }
        isDeleted={org.attributes?.includes('deleted')}
        onDelete={handleDelete}
        onUndelete={handleUndelete}
        onPermanentDelete={handlePermanentDeleteClick}
      />

      <Grid>
        <Grid.Col span={{ base: 12, md: 9 }}>
          <OrgDetails org={org} onUpdate={handleOrgUpdate} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Stack gap="md">
            <SubmissionsPortal
              submissions={submissions}
              onRowClick={(sub) =>
                navigate(`/submissions/${sub.submissionID}`, {
                  state: { selectID: sub.submissionID },
                })
              }
              onWorkClick={(workId) =>
                navigate(`/works/${workId}`, { state: { selectID: workId } })
              }
              onDelete={handleDeleteSubmission}
              onUndelete={handleUndeleteSubmission}
              onPermanentDelete={handlePermanentDeleteSubmissionClick}
              displayField="work"
            />
            <NotesPortal
              title="Journal Notes"
              notes={notes}
              onAdd={handleAddNote}
              onUpdate={handleUpdateNote}
              onDelete={handleDeleteNote}
              onUndelete={handleUndeleteNote}
              onPermanentDelete={handlePermanentDeleteNote}
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
      <ConfirmDeleteModal
        opened={subDeleteModalOpen}
        onClose={() => {
          setSubDeleteModalOpen(false);
          setDeletingSubID(null);
        }}
        onConfirm={handlePermanentDeleteSubmission}
        confirmation={subDeleteConfirmation}
        loading={subDeleteLoading}
      />
    </Stack>
  );
}
