import { useState, useEffect, useCallback, useRef } from 'react';
import { Stack, Grid, Loader, Flex, Text, Group } from '@mantine/core';
import { IconBook2 } from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { EventsOn, EventsOff } from '@wailsjs/runtime/runtime';
import { LogErr, Log, showValidationResult } from '@/utils';
import { useNotes } from '@/hooks';
import { useDebug } from '@/stores';
import { useNavigation } from '@trueblocks/scaffold';
import {
  GetWork,
  GetSubmissionViewsByWork,
  GetWorkCollections,
  DeleteSubmission,
  UndeleteSubmission,
  DeleteSubmissionPermanent,
  RemoveWorkFromCollection,
  AddWorkToCollection,
  SetLastWorkID,
  DeleteWork,
  UndeleteWork,
  GetWorkDeleteConfirmation,
  DeleteWorkPermanent,
  OpenDocument,
  RegeneratePDF,
  UpdateWork,
} from '@app';
import { models, db } from '@models';
import {
  DetailHeader,
  PathDisplay,
  NotesPortal,
  SupportingPortal,
  SubmissionsPortal,
  CollectionsPortal,
  CollectionPickerModal,
  FileActionsToolbar,
  PDFPreview,
  DebugPopover,
  ConfirmDeleteModal,
  EditableField,
  TypeSelect,
  StatusSelect,
  QualitySelect,
  YearSelect,
} from '@/components';

interface WorkDetailProps {
  workId: number;
  filteredWorks: models.WorkView[];
}

export function WorkDetail({ workId, filteredWorks }: WorkDetailProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const navigation = useNavigation();
  const { debugMode } = useDebug();
  const [work, setWork] = useState<models.Work | null>(null);
  const [submissions, setSubmissions] = useState<models.SubmissionView[]>([]);
  const [collections, setCollections] = useState<models.CollectionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);

  // Store collection context in a ref so it persists across prev/next navigation
  const collectionContextRef = useRef<{
    fromCollection?: number;
    collectionWorks?: number[];
  } | null>(null);
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
  } = useNotes('work', workId);

  // Check if we came from a collection or another page (only on initial mount or new state)
  const locationState = location.state as {
    fromCollection?: number;
    collectionWorks?: number[];
    returnTo?: string;
  } | null;

  // Store returnTo in ref so it persists across prev/next navigation
  const returnToRef = useRef<string | undefined>(locationState?.returnTo);

  // Update ref when we get new collection context from location.state
  useEffect(() => {
    if (locationState?.fromCollection) {
      collectionContextRef.current = locationState;
    }
  }, [locationState]);

  // Convenience accessor for current collection context
  const collectionContext = collectionContextRef.current;

  // If we came from a collection, populate navigation with collection works
  useEffect(() => {
    if (locationState?.collectionWorks && locationState.collectionWorks.length > 0) {
      const items = locationState.collectionWorks.map((id) => ({ id }));
      navigation.setItems('work', items, workId);
    }
    // Only run when location.state changes (entering from collection)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationState]);

  // If stack is empty and we have filteredWorks (e.g., on app restart), populate from list
  useEffect(() => {
    if (
      navigation.stack.length === 0 &&
      filteredWorks.length > 0 &&
      !locationState?.collectionWorks
    ) {
      const items = filteredWorks.map((w) => ({ id: w.workID }));
      navigation.setItems('work', items, workId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredWorks, navigation.stack.length]);

  // Use navigation context for prev/next (populated by WorksList or Collection)
  const hasPrev = navigation.hasPrev;
  const hasNext = navigation.hasNext;

  // Keep workId in sync with navigation (only when workId changes, not when navigation changes)
  useEffect(() => {
    navigation.setCurrentId(workId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workId]);

  // Helper to navigate to a work while preserving collection context
  const navigateToWork = useCallback(
    (newWorkId: number) => {
      if (collectionContext?.fromCollection) {
        navigate(`/works/${newWorkId}`, {
          state: {
            fromCollection: collectionContext.fromCollection,
            collectionWorks: collectionContext.collectionWorks,
          },
        });
      } else {
        navigate(`/works/${newWorkId}`);
      }
    },
    [navigate, collectionContext]
  );

  const handlePrev = useCallback(() => {
    if (hasPrev && navigation.currentLevel) {
      const idx = navigation.currentIndex;
      const prevItem = navigation.currentLevel.items[idx - 1] as { id: number } | undefined;
      if (prevItem) {
        navigation.setCurrentId(prevItem.id);
        navigateToWork(prevItem.id);
      }
    }
  }, [hasPrev, navigation, navigateToWork]);

  const handleNext = useCallback(() => {
    if (hasNext && navigation.currentLevel) {
      const idx = navigation.currentIndex;
      const nextItem = navigation.currentLevel.items[idx + 1] as { id: number } | undefined;
      if (nextItem) {
        navigation.setCurrentId(nextItem.id);
        navigateToWork(nextItem.id);
      }
    }
  }, [hasNext, navigation, navigateToWork]);

  const handleHome = useCallback(() => {
    if (navigation.currentLevel && navigation.currentLevel.items.length > 0) {
      const firstItem = navigation.currentLevel.items[0] as { id: number } | undefined;
      if (firstItem) {
        navigation.setCurrentId(firstItem.id);
        navigateToWork(firstItem.id);
      }
    }
  }, [navigation, navigateToWork]);

  const handleEnd = useCallback(() => {
    if (navigation.currentLevel && navigation.currentLevel.items.length > 0) {
      const lastItem = navigation.currentLevel.items[navigation.currentLevel.items.length - 1] as
        | { id: number }
        | undefined;
      if (lastItem) {
        navigation.setCurrentId(lastItem.id);
        navigateToWork(lastItem.id);
      }
    }
  }, [navigation, navigateToWork]);

  const handleReturnToList = useCallback(() => {
    // If we have a returnTo, use it (from portal navigation)
    if (returnToRef.current) {
      navigate(returnToRef.current);
    } else if (collectionContext?.fromCollection) {
      // If we came from a collection, go back to that collection
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
    const notificationId = 'open-document';
    try {
      Log('[WorkDetail] handleOpen called for workId:', workId);
      Log('[WorkDetail] Current work path:', work?.path);
      notifications.show({
        id: notificationId,
        title: 'Opening Document',
        message: 'Launching application...',
        loading: true,
        autoClose: false,
        withCloseButton: false,
      });
      await OpenDocument(workId);
      notifications.update({
        id: notificationId,
        title: 'Document Opened',
        message: 'The document has been sent to the default application',
        loading: false,
        autoClose: 2000,
        withCloseButton: true,
      });
    } catch (err) {
      LogErr('Failed to open document:', err);
      notifications.update({
        id: notificationId,
        title: 'Failed to Open Document',
        message: String(err),
        color: 'red',
        loading: false,
        autoClose: 5000,
        withCloseButton: true,
      });
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
    ['mod+O', handleOpen],
    ['mod+R', handleRegeneratePDF],
  ]);

  const handleWorkUpdate = useCallback((updatedWork: models.Work) => {
    setWork(updatedWork);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      if (!work || newTitle === work.title) return;
      const updated = { ...work, title: newTitle };
      try {
        const result = await UpdateWork(updated as models.Work);
        if (!showValidationResult(result)) {
          setWork(updated as models.Work);
          setRefreshKey((k) => k + 1);
        }
      } catch (err) {
        LogErr('Failed to update title:', err);
      }
    },
    [work]
  );

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

  // Listen for preview updates from file watcher
  useEffect(() => {
    const unsubscribe = EventsOn('preview:updated', (updatedWorkId: number) => {
      if (updatedWorkId === workId) {
        Log(`[WorkDetail] Preview updated for workID ${workId}, refreshing`);
        setRefreshKey((k) => k + 1);
      }
    });
    return () => {
      EventsOff('preview:updated');
      unsubscribe();
    };
  }, [workId]);

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

  const handleAssignLastCollection = useCallback(async () => {
    if (!workId) return;
    const lastCollectionData = localStorage.getItem('lastAssignedCollection');
    if (!lastCollectionData) {
      notifications.show({
        title: 'No last collection',
        message: 'Assign a work to a collection first',
        color: 'yellow',
      });
      return;
    }
    const { collID, collectionName } = JSON.parse(lastCollectionData);
    // Check if already in this collection
    if (collections.some((c) => c.collID === collID)) {
      notifications.show({
        title: 'Already assigned',
        message: `Work is already in "${collectionName}"`,
        color: 'blue',
      });
      return;
    }
    await AddWorkToCollection(collID, workId);
    const updated = await GetWorkCollections(workId);
    setCollections(updated || []);
    notifications.show({
      title: 'Collection assigned',
      message: `Added to "${collectionName}"`,
      color: 'green',
    });
  }, [workId, collections]);

  const handleRemoveFromAllCollections = useCallback(async () => {
    if (!workId || collections.length === 0) {
      notifications.show({
        title: 'No collections',
        message: 'Work is not in any collections',
        color: 'yellow',
      });
      return;
    }
    await Promise.all(collections.map((c) => RemoveWorkFromCollection(c.collID, workId)));
    setCollections([]);
    notifications.show({
      title: 'Removed from all',
      message: `Removed from ${collections.length} collection(s)`,
      color: 'green',
    });
  }, [workId, collections]);

  // Collection hotkeys
  useHotkeys([
    ['mod+L', handleAssignLastCollection],
    ['mod+shift+0', handleRemoveFromAllCollections],
  ]);

  const handleDeleteSubmission = useCallback(
    async (subId: number) => {
      if (!workId) return;
      await DeleteSubmission(subId);
      const updated = await GetSubmissionViewsByWork(workId);
      setSubmissions(updated || []);
    },
    [workId]
  );

  const handleUndeleteSubmission = useCallback(
    async (subId: number) => {
      if (!workId) return;
      await UndeleteSubmission(subId);
      const updated = await GetSubmissionViewsByWork(workId);
      setSubmissions(updated || []);
    },
    [workId]
  );

  // Direct delete without confirmation - used in SubmissionsPortal
  const handlePermanentDeleteSubmissionDirect = useCallback(
    async (subId: number) => {
      if (!workId) return;
      try {
        await DeleteSubmissionPermanent(subId);
        const updated = await GetSubmissionViewsByWork(workId);
        setSubmissions(updated || []);
      } catch (err) {
        LogErr('Failed to permanently delete submission:', err);
      }
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

  const handlePermanentDelete = useCallback(
    async (archiveDocument: boolean) => {
      if (!work) return;
      setDeleteLoading(true);
      try {
        await DeleteWorkPermanent(work.workID, archiveDocument);
        setDeleteModalOpen(false);
        notifications.show({
          message: archiveDocument
            ? 'Work permanently deleted and document archived'
            : 'Work permanently deleted',
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
    },
    [work, navigate]
  );

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
      <DetailHeader
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={handlePrev}
        onNext={handleNext}
        onBack={handleReturnToList}
        currentIndex={navigation.currentIndex}
        totalCount={navigation.currentLevel?.items.length ?? 0}
        icon={<IconBook2 size={24} />}
        title={
          <Group gap="xs" align="baseline">
            <EditableField
              value={work.title}
              onChange={handleTitleChange}
              placeholder="Work title"
              size="xl"
            />
            <Text c="dark.3" size="md">
              (#{work.workID})
            </Text>
          </Group>
        }
        subtitle={
          <>
            <TypeSelect work={work} onUpdate={handleWorkUpdate} />
            <StatusSelect work={work} onUpdate={handleWorkUpdate} />
            <QualitySelect work={work} onUpdate={handleWorkUpdate} />
            <YearSelect work={work} onUpdate={handleWorkUpdate} />
            {work.status === 'Published' && work.qualityAtPublish && (
              <Text size="sm" c="dimmed" fs="italic">
                (was {work.qualityAtPublish})
              </Text>
            )}
          </>
        }
        secondaryRow={
          <PathDisplay path={work.path} docType={work.docType} nWords={work.nWords} noPaper />
        }
        actionsRight={
          <FileActionsToolbar workID={work.workID} refreshKey={refreshKey} onMoved={loadData} />
        }
        isDeleted={work.attributes?.includes('deleted')}
        onDelete={handleDelete}
        onUndelete={handleUndelete}
        onPermanentDelete={handlePermanentDeleteClick}
      />

      <Grid>
        <Grid.Col span={{ base: 12, md: 9 }}>
          <PDFPreview workID={work.workID} height="calc(100vh - 280px)" refreshKey={refreshKey} />
        </Grid.Col>
        <Grid.Col
          span={{ base: 12, md: 3 }}
          style={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}
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
                  state: { returnTo: `/works/${workId}` },
                })
              }
              onOrgClick={(orgId) =>
                navigate(`/organizations/${orgId}`, {
                  state: { returnTo: `/works/${workId}` },
                })
              }
              onDelete={handleDeleteSubmission}
              onUndelete={handleUndeleteSubmission}
              onPermanentDelete={handlePermanentDeleteSubmissionDirect}
            />
            <NotesPortal
              notes={notes}
              onAdd={handleAddNote}
              onUpdate={handleUpdateNote}
              onDelete={handleDeleteNote}
              onUndelete={handleUndeleteNote}
              onPermanentDelete={handlePermanentDeleteNote}
            />
            <SupportingPortal workId={workId} workPath={work.path || undefined} />
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
