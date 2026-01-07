import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Stack, Grid, Loader, Flex, Text } from '@mantine/core';
import { LogErr } from '@/utils';
import { useNotes } from '@/hooks';
import {
  GetWork,
  GetSubmissionViewsByWork,
  GetWorkCollections,
  DeleteSubmission,
  RemoveWorkFromCollection,
  SetLastWorkID,
} from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import {
  WorkHeader,
  PathDisplay,
  NotesPortal,
  SubmissionsPortal,
  CollectionsPortal,
  FileActionsToolbar,
  PDFPreview,
} from '@/components';

export function WorkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [work, setWork] = useState<models.Work | null>(null);
  const [submissions, setSubmissions] = useState<models.SubmissionView[]>([]);
  const [collections, setCollections] = useState<models.CollectionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const workId = id ? parseInt(id, 10) : null;
  const {
    notes,
    handleAdd: handleAddNote,
    handleUpdate: handleUpdateNote,
    handleDelete: handleDeleteNote,
  } = useNotes('work', workId);

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

  const handleDeleteSubmission = useCallback(
    async (subId: number) => {
      if (!workId) return;
      await DeleteSubmission(subId);
      const updated = await GetSubmissionViewsByWork(workId);
      setSubmissions(updated || []);
    },
    [workId]
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
      <WorkHeader
        work={work}
        actions={
          <FileActionsToolbar workID={work.workID} refreshKey={refreshKey} onMoved={loadData} />
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
            <CollectionsPortal collections={collections} onRemove={handleRemoveFromCollection} />
            <SubmissionsPortal
              submissions={submissions}
              onRowClick={(sub) => navigate(`/submissions/${sub.submissionID}`)}
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
