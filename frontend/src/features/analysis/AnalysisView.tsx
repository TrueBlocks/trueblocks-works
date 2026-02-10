import { useState, useEffect, useCallback } from 'react';
import { Tabs, Stack, Text, Alert, Select } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { LogErr } from '@/utils';
import {
  GetAnalysisEnabled,
  GetCollectionAnalysis,
  AnalyzeCollection,
  DismissAnnotation,
  UndismissAnnotation,
  GetWorkAnalysis,
  AnalyzeWork,
  GetCollectionWorks,
} from '@app';
import { analysis, models } from '@models';
import { WorkAnalysisPanel, CollectionAnalysisPanel } from './components';

interface AnalysisViewProps {
  collectionId: number;
  collectionName: string;
}

export function AnalysisView({ collectionId }: AnalysisViewProps) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('collection');

  // Collection analysis state
  const [collectionResult, setCollectionResult] = useState<analysis.CollectionResult | null>(null);
  const [collectionLoading, setCollectionLoading] = useState(false);

  // Work analysis state
  const [works, setWorks] = useState<models.CollectionWork[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [workResult, setWorkResult] = useState<analysis.WorkResult | null>(null);
  const [workLoading, setWorkLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const isEnabled = await GetAnalysisEnabled();
        setEnabled(isEnabled);

        if (isEnabled) {
          const colWorks = await GetCollectionWorks(collectionId);
          setWorks(colWorks);

          // Try to load existing collection analysis
          try {
            const result = await GetCollectionAnalysis(collectionId);
            setCollectionResult(result);
          } catch {
            // No existing analysis, that's fine
          }
        }
      } catch (err) {
        LogErr('Failed to load analysis data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [collectionId]);

  // Load work analysis when selected
  useEffect(() => {
    if (!selectedWorkId) {
      setWorkResult(null);
      return;
    }

    async function loadWorkAnalysis() {
      try {
        const result = await GetWorkAnalysis(parseInt(selectedWorkId!, 10));
        setWorkResult(result);
      } catch {
        setWorkResult(null);
      }
    }
    loadWorkAnalysis();
  }, [selectedWorkId]);

  const handleAnalyzeCollection = useCallback(async () => {
    setCollectionLoading(true);
    try {
      const result = await AnalyzeCollection(collectionId);
      setCollectionResult(result);
      notifications.show({
        title: 'Analysis Complete',
        message: 'Collection analysis finished successfully.',
        color: 'green',
      });
    } catch (err) {
      LogErr('Failed to analyze collection:', err);
      notifications.show({
        title: 'Analysis Failed',
        message: String(err),
        color: 'red',
      });
    } finally {
      setCollectionLoading(false);
    }
  }, [collectionId]);

  const handleAnalyzeWork = useCallback(async () => {
    if (!selectedWorkId) return;
    setWorkLoading(true);
    try {
      const result = await AnalyzeWork(parseInt(selectedWorkId, 10));
      setWorkResult(result);
      notifications.show({
        title: 'Analysis Complete',
        message: 'Work analysis finished successfully.',
        color: 'green',
      });
    } catch (err) {
      LogErr('Failed to analyze work:', err);
      notifications.show({
        title: 'Analysis Failed',
        message: String(err),
        color: 'red',
      });
    } finally {
      setWorkLoading(false);
    }
  }, [selectedWorkId]);

  const handleDismiss = useCallback(
    async (annotationId: number, reason: string) => {
      try {
        await DismissAnnotation(annotationId, reason);
        // Reload work analysis
        if (selectedWorkId) {
          const result = await GetWorkAnalysis(parseInt(selectedWorkId, 10));
          setWorkResult(result);
        }
      } catch (err) {
        LogErr('Failed to dismiss annotation:', err);
      }
    },
    [selectedWorkId]
  );

  const handleUndismiss = useCallback(
    async (annotationId: number) => {
      try {
        await UndismissAnnotation(annotationId);
        // Reload work analysis
        if (selectedWorkId) {
          const result = await GetWorkAnalysis(parseInt(selectedWorkId, 10));
          setWorkResult(result);
        }
      } catch (err) {
        LogErr('Failed to undismiss annotation:', err);
      }
    },
    [selectedWorkId]
  );

  if (loading) {
    return (
      <Stack p="md">
        <Text c="dimmed">Loading...</Text>
      </Stack>
    );
  }

  if (!enabled) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title="Analysis Not Enabled" color="gray">
        <Stack gap="sm">
          <Text size="sm">
            The AI analysis feature is not enabled. Enable it in Settings to use this feature.
          </Text>
          <Text size="sm" c="dimmed">
            You will need to configure an API key for OpenAI, Anthropic, or set up a local Ollama
            instance.
          </Text>
        </Stack>
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="collection">Collection</Tabs.Tab>
          <Tabs.Tab value="works">Works</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="collection" pt="md">
          <CollectionAnalysisPanel
            collectionResult={collectionResult}
            loading={collectionLoading}
            onAnalyze={handleAnalyzeCollection}
          />
        </Tabs.Panel>

        <Tabs.Panel value="works" pt="md">
          <Stack gap="md">
            <Select
              label="Select a work to analyze"
              placeholder="Choose a work..."
              value={selectedWorkId}
              onChange={setSelectedWorkId}
              data={works.map((w) => ({
                value: String(w.workID),
                label: w.title,
              }))}
              searchable
              clearable
            />

            {selectedWorkId && (
              <WorkAnalysisPanel
                workId={parseInt(selectedWorkId, 10)}
                workResult={workResult}
                loading={workLoading}
                onAnalyze={handleAnalyzeWork}
                onDismiss={handleDismiss}
                onUndismiss={handleUndismiss}
              />
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
