import { useState, useEffect, useCallback } from 'react';
import { Paper, Loader, Text, Stack, ActionIcon, Group, Tooltip } from '@mantine/core';
import { IconRefresh, IconMaximize, IconMinimize } from '@tabler/icons-react';
import { GetPreviewURL, RegeneratePDF } from '@app';

interface PDFPreviewProps {
  workID: number;
  height?: number | string;
  refreshKey?: number;
}

export function PDFPreview({ workID, height = 500, refreshKey = 0 }: PDFPreviewProps) {
  const [pdfURL, setPdfURL] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [lastRefreshKey, setLastRefreshKey] = useState(0);

  const loadPreview = useCallback(async () => {
    if (!workID) return;
    setLoading(true);
    setError(null);
    try {
      const url = await GetPreviewURL(workID);
      setPdfURL(url);
    } catch {
      setError('No preview available');
      setPdfURL(null);
    } finally {
      setLoading(false);
    }
  }, [workID]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  // Only force reload when refreshKey actually increments (Cmd+R pressed)
  useEffect(() => {
    if (refreshKey > 0 && refreshKey !== lastRefreshKey) {
      setLastRefreshKey(refreshKey);
      loadPreview();
    }
  }, [refreshKey, lastRefreshKey, loadPreview]);

  const handleRegenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = await RegeneratePDF(workID);
      setPdfURL(url);
    } catch {
      setError('Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Paper p="md" withBorder h={height}>
        <Stack align="center" justify="center" h="100%">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Loading preview...
          </Text>
        </Stack>
      </Paper>
    );
  }

  if (error || !pdfURL) {
    return (
      <Paper p="md" withBorder h={height}>
        <Stack align="center" justify="center" h="100%">
          <Text c="dimmed">{error || 'No preview available'}</Text>
          <ActionIcon variant="subtle" onClick={handleRegenerate}>
            <IconRefresh size={18} />
          </ActionIcon>
        </Stack>
      </Paper>
    );
  }

  const effectiveHeight = expanded ? '80vh' : height;

  return (
    <Paper withBorder style={{ height: effectiveHeight, overflow: 'hidden' }}>
      <Group
        justify="flex-end"
        p="xs"
        style={{ position: 'absolute', top: 0, right: 0, zIndex: 10 }}
      >
        <Tooltip label="Regenerate PDF">
          <ActionIcon variant="subtle" size="sm" onClick={handleRegenerate}>
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={expanded ? 'Collapse' : 'Expand'}>
          <ActionIcon variant="subtle" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? <IconMinimize size={16} /> : <IconMaximize size={16} />}
          </ActionIcon>
        </Tooltip>
      </Group>
      <iframe
        key={pdfURL}
        src={pdfURL}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        title="PDF Preview"
      />
    </Paper>
  );
}
