import { useState, useEffect, useCallback } from 'react';
import { Stack, Grid, Loader, Flex, Text, ActionIcon, Group, Tooltip } from '@mantine/core';
import { IconChevronUp, IconChevronDown, IconTrash, IconRestore, IconX } from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { LogErr, Log } from '@/utils';
import { useNotes } from '@/hooks';
import { useDebug } from '@/stores';
import {
  GetWork,
  GetSubmissionViewsByWork,
  GetWorkCollections,
  DeleteSubmission,
  RemoveWorkFromCollection,
  SetLastWorkID,
  DeleteWork,
  UndeleteWork,
  GetWorkDeleteConfirmation,
  DeleteWorkPermanent,
  OpenDocument,
  RegeneratePDF,
} from '@wailsjs/go/main/App';
import { models, db } from '@wailsjs/go/models';
import {
  WorkHeader,
  PathDisplay,
  NotesPortal,
  SubmissionsPortal,
  CollectionsPortal,
  CollectionPickerModal,
  FileActionsToolbar,
  PDFPreview,
  DebugPopover,
  ConfirmDeleteModal,
} from '@/components';

interface WorkDetailProps {
  workId: number;
  filteredWorks: models.WorkView[];
}

export function WorkDetail({ workId, filteredWorks }: WorkDetailProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { debugMode } = useDebug();
  const [work, setWork] = useState<models.Work | null>(null);
  const [submissions, setSubmissions] = useState<models.SubmissionView[]>([]);
  const [collections, setCollections] = useState<models.CollectionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<db.DeleteConfirmation | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const {
    notes,
    handleAdd: handleAddNote,
    handleUpdate: handleUpdateNote,
    handleDelete: handleDeleteNote,
  } = useNotes('work', workId);

  // Check if we came from a collection
  const collectionContext = location.state as {
    fromCollection?: number;
    collectionWorks?: number[];
  } | null;

  // Use collection works if present, otherwise use filtered works
  const worksToNavigate = collectionContext?.collectionWorks || filteredWorks.map((w) => w.workID);
  const currentIndex = worksToNavigate.indexOf(workId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < worksToNavigate.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      const prevWorkID = worksToNavigate[currentIndex - 1];
      navigate(`/works/${prevWorkID}`, { state: collectionContext });
    }
  }, [hasPrev, worksToNavigate, currentIndex, navigate, collectionContext]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      const nextWorkID = worksToNavigate[currentIndex + 1];
      navigate(`/works/${nextWorkID}`, { state: collectionContext });
    }
  }, [hasNext, worksToNavigate, currentIndex, navigate, collectionContext]);

  const handleHome = useCallback(() => {
    if (worksToNavigate.length > 0 && currentIndex !== 0) {
      navigate(`/works/${worksToNavigate[0]}`, { state: collectionContext });
    }
  }, [worksToNavigate, currentIndex, navigate, collectionContext]);

  const handleEnd = useCallback(() => {
    if (worksToNavigate.length > 0 && currentIndex !== worksToNavigate.length - 1) {
      navigate(`/works/${worksToNavigate[worksToNavigate.length - 1]}`, {
        state: collectionContext,
      });
    }
  }, [worksToNavigate, currentIndex, navigate, collectionContext]);

  const handleReturnToList = useCallback(() => {
    // If we came from a collection, go back to that collection
    if (collectionContext?.fromCollection) {
      navigate(`/collections/${collectionContext.fromCollection}`, {
        state: { selectID: workId },
      });
    } else {
      navigate('/works', {
        state: { selectID: workId },
      });
    }
  }, [navigate, collectionContext, workId]);

  const handleOpen = useCallback(async () => {
    try {
      Log('[WorkDetail] handleOpen called for workId:', workId);
      Log('[WorkDetail] Current work path:', work?.path);
      await OpenDocument(workId);
    } catch (err) {
      LogErr('Failed to open document:', err);
    }
  }, [workId, work?.path]);

  const handleRegeneratePDF = useCallback(async () => {
    try {
      await RegeneratePDF(workId);
      // Force immediate refresh by incrementing key - this will cause PDFPreview to reload
      setRefreshKey((k) => k + 1);
    } catch (err) {
      LogErr('Failed to regenerate PDF:', err);
      notifications.show({
        message: 'Failed to regenerate PDF',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, [workId]);

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
    ['mod+O', handleOpen],
    ['mod+R', handleRegeneratePDF],
  ]);

  const handleWorkUpdate = useCallback((updatedWork: models.Work) => {
    setWork(updatedWork);
    setRefreshKey((k) => k + 1);
  }, []);

  const loadData = useCallback(async () => {
    if (!workId) return;
    setLoading(true);
    try {
      const [workData, subsData, collsData] = await Promise.all([
        GetWork(workId),
        GetSubmissionViewsByWork(workId),
        GetWorkCollections(workId),
      ]);
      setWork(workData);
      setSubmissions(subsData || []);
      setCollections(collsData || []);
      SetLastWorkID(workId);
    } catch (err) {
      LogErr('Failed to load work data:', err);
    } finally {
      setLoading(false);
    }
  }, [workId]);

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

  const handleRemoveFromCollection = useCallback(
    async (collId: number) => {
      if (!workId) return;
      await RemoveWorkFromCollection(collId, workId);
      const updated = await GetWorkCollections(workId);
      setCollections(updated || []);
    },
    [workId]
  );

  const refreshCollections = useCallback(async () => {
    if (!workId) return;
    const updated = await GetWorkCollections(workId);
    setCollections(updated || []);
  }, [workId]);

  const handleDeleteSubmission = useCallback(
    async (subId: number) => {
      if (!workId) return;
      await DeleteSubmission(subId);
      const updated = await GetSubmissionViewsByWork(workId);
      setSubmissions(updated || []);
    },
    [workId]
  );

  const handleDelete = useCallback(async () => {
    if (!work) return;
    try {
      await DeleteWork(work.workID);
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
      loadData();
    } catch (err) {
      LogErr('Failed to delete work:', err);
      notifications.show({
        message: 'Delete failed',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, [work, loadData]);

  const handleUndelete = useCallback(async () => {
    if (!work) return;
    try {
      await UndeleteWork(work.workID);
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
      loadData();
    } catch (err) {
      LogErr('Failed to restore work:', err);
      notifications.show({
        message: 'Restore failed',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, [work, loadData]);

  const handlePermanentDeleteClick = useCallback(async () => {
    if (!work) return;
    try {
      const conf = await GetWorkDeleteConfirmation(work.workID);
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
  }, [work]);

  const handlePermanentDelete = useCallback(async () => {
    if (!work) return;
    setDeleteLoading(true);
    try {
      await DeleteWorkPermanent(work.workID);
      setDeleteModalOpen(false);
      notifications.show({
        message: 'Work permanently deleted',
        color: 'green',
        autoClose: 3000,
      });
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
      navigate('/works');
    } catch (err) {
      LogErr('Failed to permanently delete work:', err);
      notifications.show({
        message: 'Permanent delete failed',
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setDeleteLoading(false);
    }
  }, [work, navigate]);

  if (loading) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  if (!work) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Text c="dimmed">Work not found</Text>
      </Flex>
    );
  }

  return (
    <Stack gap="lg">
      <WorkHeader
        work={work}
        actions={
          <Group gap="xs">
            <Tooltip label="Previous work (↑)">
              <ActionIcon
                variant="subtle"
                size="lg"
                onClick={handlePrev}
                disabled={!hasPrev}
                aria-label="Previous work"
              >
                <IconChevronUp />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Next work (↓)">
              <ActionIcon
                variant="subtle"
                size="lg"
                onClick={handleNext}
                disabled={!hasNext}
                aria-label="Next work"
              >
                <IconChevronDown />
              </ActionIcon>
            </Tooltip>
            <FileActionsToolbar workID={work.workID} refreshKey={refreshKey} onMoved={loadData} />
            {work.attributes?.includes('deleted') ? (
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
            )}
          </Group>
        }
        onWorkUpdate={handleWorkUpdate}
      />
      <PathDisplay path={work.path} docType={work.docType} nWords={work.nWords} />

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <PDFPreview workID={work.workID} height="calc(100vh - 240px)" refreshKey={refreshKey} />
        </Grid.Col>
        <Grid.Col
          span={{ base: 12, md: 4 }}
          style={{ maxHeight: 'calc(100vh - 240px)', overflow: 'auto' }}
        >
          <Stack gap="md">
            <CollectionsPortal
              collections={collections}
              onAdd={() => setCollectionPickerOpen(true)}
              onRemove={handleRemoveFromCollection}
              onCollectionClick={(collID) =>
                navigate(`/collections/${collID}`, { state: { selectID: collID } })
              }
            />
            <CollectionPickerModal
              opened={collectionPickerOpen}
              onClose={() => setCollectionPickerOpen(false)}
              workID={work.workID}
              onUpdate={refreshCollections}
            />
            <SubmissionsPortal
              submissions={submissions}
              onRowClick={(sub) =>
                navigate(`/submissions/${sub.submissionID}`, {
                  state: { selectID: sub.submissionID },
                })
              }
              onDelete={handleDeleteSubmission}
            />
            <NotesPortal
              notes={notes}
              onAdd={handleAddNote}
              onUpdate={handleUpdateNote}
              onDelete={handleDeleteNote}
            />
          </Stack>
        </Grid.Col>
      </Grid>
      {debugMode && <DebugPopover workId={workId} />}
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
