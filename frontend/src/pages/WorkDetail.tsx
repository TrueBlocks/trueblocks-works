import { useState, useEffect, useCallback } from 'react';
import { Stack, Grid, Loader, Flex, Text, ActionIcon, Group, Tooltip, Button } from '@mantine/core';
import { IconChevronUp, IconChevronDown, IconTrash, IconRestore } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { LogErr } from '@/utils';
import { useNotes } from '@/hooks';
import {
  GetWork,
  GetSubmissionViewsByWork,
  GetWorkCollections,
  DeleteSubmission,
  RemoveWorkFromCollection,
  SetLastWorkID,
  DeleteWork,
  UndeleteWork,
} from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import {
  WorkHeader,
  PathDisplay,
  NotesPortal,
  SubmissionsPortal,
  CollectionsPortal,
  CollectionPickerModal,
  FileActionsToolbar,
  PDFPreview,
} from '@/components';

interface WorkDetailProps {
  workId: number;
  filteredWorks: models.WorkView[];
}

export function WorkDetail({ workId, filteredWorks }: WorkDetailProps) {
  const navigate = useNavigate();
  const [work, setWork] = useState<models.Work | null>(null);
  const [submissions, setSubmissions] = useState<models.SubmissionView[]>([]);
  const [collections, setCollections] = useState<models.CollectionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);

  const {
    notes,
    handleAdd: handleAddNote,
    handleUpdate: handleUpdateNote,
    handleDelete: handleDeleteNote,
  } = useNotes('work', workId);

  const currentIndex = filteredWorks.findIndex((w) => w.workID === workId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < filteredWorks.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      const prevWork = filteredWorks[currentIndex - 1];
      navigate(`/works/${prevWork.workID}`);
    }
  }, [hasPrev, filteredWorks, currentIndex, navigate]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      const nextWork = filteredWorks[currentIndex + 1];
      navigate(`/works/${nextWork.workID}`);
    }
  }, [hasNext, filteredWorks, currentIndex, navigate]);

  const handleHome = useCallback(() => {
    if (filteredWorks.length > 0 && currentIndex !== 0) {
      navigate(`/works/${filteredWorks[0].workID}`);
    }
  }, [filteredWorks, currentIndex, navigate]);

  const handleEnd = useCallback(() => {
    if (filteredWorks.length > 0 && currentIndex !== filteredWorks.length - 1) {
      navigate(`/works/${filteredWorks[filteredWorks.length - 1].workID}`);
    }
  }, [filteredWorks, currentIndex, navigate]);

  const handleReturnToList = useCallback(() => {
    navigate('/works', { replace: true });
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
        title: 'Delete Failed',
        message: 'Could not delete work',
        color: 'red',
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
        title: 'Restore Failed',
        message: 'Could not restore work',
        color: 'red',
      });
    }
  }, [work, loadData]);

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
            )}
          </Group>
        }
        onWorkUpdate={handleWorkUpdate}
      />
      <PathDisplay path={work.path} docType={work.docType} nWords={work.nWords} />

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <PDFPreview workID={work.workID} height="calc(100vh - 240px)" />
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
    </Stack>
  );
}
