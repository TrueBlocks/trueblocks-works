import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Stack, Grid, Loader, Flex, Text, Group, Badge, Button, Tooltip } from '@mantine/core';
import { IconExternalLink, IconBuilding } from '@tabler/icons-react';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { LogErr, showValidationResult } from '@/utils';
import { useNotes } from '@/hooks';
import { useNavigation } from '@trueblocks/scaffold';
import {
  GetOrganization,
  SetLastOrgID,
  GetSubmissionViewsByOrg,
  DeleteSubmission,
  UndeleteSubmission,
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
  filteredOrganizations?: models.OrganizationWithNotes[];
}

export function OrganizationDetail({ organizationId }: OrganizationDetailProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const navigation = useNavigation();
  const { hasPrev, hasNext, currentIndex, currentLevel } = navigation;
  const returnToRef = useRef<string | undefined>(
    (location.state as { returnTo?: string } | null)?.returnTo
  );
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
    handleUndelete: handleUndeleteNote,
    handlePermanentDelete: handlePermanentDeleteNote,
  } = useNotes('journal', organizationId);

  const navigateToOrg = useCallback(
    (id: number) => {
      navigate(`/organizations/${id}`);
    },
    [navigate]
  );

  const handlePrev = useCallback(() => {
    if (hasPrev && currentLevel) {
      const idx = navigation.currentIndex;
      const prevItem = currentLevel.items[idx - 1] as { id: number } | undefined;
      if (prevItem) {
        navigation.setCurrentId(prevItem.id);
        navigateToOrg(prevItem.id);
      }
    }
  }, [hasPrev, currentLevel, navigation, navigateToOrg]);

  const handleNext = useCallback(() => {
    if (hasNext && currentLevel) {
      const idx = navigation.currentIndex;
      const nextItem = currentLevel.items[idx + 1] as { id: number } | undefined;
      if (nextItem) {
        navigation.setCurrentId(nextItem.id);
        navigateToOrg(nextItem.id);
      }
    }
  }, [hasNext, currentLevel, navigation, navigateToOrg]);

  const handleHome = useCallback(() => {
    if (currentLevel && currentLevel.items.length > 0) {
      const firstItem = currentLevel.items[0] as { id: number } | undefined;
      if (firstItem) {
        navigation.setCurrentId(firstItem.id);
        navigateToOrg(firstItem.id);
      }
    }
  }, [currentLevel, navigation, navigateToOrg]);

  const handleEnd = useCallback(() => {
    if (currentLevel && currentLevel.items.length > 0) {
      const lastItem = currentLevel.items[currentLevel.items.length - 1] as
        | { id: number }
        | undefined;
      if (lastItem) {
        navigation.setCurrentId(lastItem.id);
        navigateToOrg(lastItem.id);
      }
    }
  }, [currentLevel, navigation, navigateToOrg]);

  const handleReturnToList = useCallback(() => {
    if (returnToRef.current) {
      navigate(returnToRef.current);
    } else {
      navigate('/organizations', { state: { selectID: organizationId } });
    }
  }, [navigate, organizationId]);

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

  // Direct delete without confirmation - used in SubmissionsPortal
  const handlePermanentDeleteSubmissionDirect = useCallback(
    async (subId: number) => {
      try {
        await DeleteSubmissionPermanent(subId);
        const updated = await GetSubmissionViewsByOrg(organizationId);
        setSubmissions(updated || []);
      } catch (err) {
        LogErr('Failed to permanently delete submission:', err);
      }
    },
    [organizationId]
  );

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
        totalCount={currentLevel?.items.length ?? 0}
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
                  state: { returnTo: `/organizations/${organizationId}` },
                })
              }
              onWorkClick={(workId) =>
                navigate(`/works/${workId}`, {
                  state: { returnTo: `/organizations/${organizationId}` },
                })
              }
              onDelete={handleDeleteSubmission}
              onUndelete={handleUndeleteSubmission}
              onPermanentDelete={handlePermanentDeleteSubmissionDirect}
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
    </Stack>
  );
}
