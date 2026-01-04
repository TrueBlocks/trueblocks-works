import { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Title,
  Text,
  Paper,
  Button,
  Group,
  Table,
  Badge,
  Alert,
  Loader,
  Code,
  Kbd,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconDownload,
  IconFolderOpen,
  IconCheck,
  IconX,
  IconAlertCircle,
} from '@tabler/icons-react';
import {
  GetExportTables,
  GetExportFolderPath,
  SelectExportFolder,
  ExportAllTables,
  OpenExportFolder,
} from '@wailsjs/go/main/App';
import { Log, LogErr } from '@/utils';
import { useHotkeys } from '@mantine/hooks';

interface TableInfo {
  name: string;
  count: number;
}

interface ExportResult {
  table: string;
  count: number;
  success: boolean;
  error?: string;
}

export function ExportPage() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [exportPath, setExportPath] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [results, setResults] = useState<ExportResult[] | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tablesData, pathData] = await Promise.all([GetExportTables(), GetExportFolderPath()]);
      setTables(tablesData || []);
      setExportPath(pathData || '');
    } catch (err) {
      LogErr('Failed to load export data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectFolder = async () => {
    try {
      const folder = await SelectExportFolder();
      if (folder) {
        setExportPath(folder);
        setResults(null);
      }
    } catch (err) {
      LogErr('Failed to select folder:', err);
    }
  };

  const handleExport = useCallback(async () => {
    if (!exportPath) {
      await handleSelectFolder();
      return;
    }

    setExporting(true);
    setResults(null);
    try {
      const exportResults = await ExportAllTables();
      setResults(exportResults);
      Log('Export completed:', exportResults);

      const successCount = exportResults?.filter((r: ExportResult) => r.success).length || 0;
      const failCount = exportResults?.filter((r: ExportResult) => !r.success).length || 0;

      if (failCount > 0) {
        notifications.show({
          title: 'Export Completed with Errors',
          message: `${successCount} tables exported, ${failCount} failed`,
          color: 'red',
          icon: <IconX size={16} />,
        });
      } else {
        notifications.show({
          title: 'Export Completed',
          message: `${successCount} tables exported successfully`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      }
    } catch (err) {
      LogErr('Export failed:', err);
      notifications.show({
        title: 'Export Failed',
        message: String(err),
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setExporting(false);
    }
  }, [exportPath]);

  useHotkeys([['mod+x', () => !exporting && handleExport()]]);

  const handleOpenFolder = async () => {
    try {
      await OpenExportFolder();
    } catch (err) {
      LogErr('Failed to open folder:', err);
    }
  };

  const totalRecords = tables.reduce((sum, t) => sum + t.count, 0);
  const successCount = results?.filter((r) => r.success).length || 0;
  const failCount = results?.filter((r) => !r.success).length || 0;

  if (loading) {
    return (
      <Stack align="center" justify="center" h="100%">
        <Loader />
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Title order={2}>Export Data</Title>

      <Paper p="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <div>
              <Text fw={500}>Export Folder</Text>
              <Text size="sm" c="dimmed">
                JSON files will be saved to this location
              </Text>
            </div>
            <Button
              variant="light"
              leftSection={<IconFolderOpen size={16} />}
              onClick={handleSelectFolder}
            >
              {exportPath ? 'Change Folder' : 'Select Folder'}
            </Button>
          </Group>

          {exportPath ? (
            <Group>
              <Code>{exportPath}</Code>
              <Button variant="subtle" size="xs" onClick={handleOpenFolder}>
                Open in Finder
              </Button>
            </Group>
          ) : (
            <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
              Please select an export folder before exporting
            </Alert>
          )}
        </Stack>
      </Paper>

      <Paper p="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <div>
              <Text fw={500}>Tables to Export</Text>
              <Text size="sm" c="dimmed">
                {tables.length} tables, {totalRecords.toLocaleString()} total records
              </Text>
            </div>
            <Group gap="sm">
              <Button
                leftSection={<IconDownload size={16} />}
                onClick={handleExport}
                loading={exporting}
                disabled={!exportPath && tables.length === 0}
              >
                Export All Tables
              </Button>
              <Kbd>⌘X</Kbd>
            </Group>
          </Group>

          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Table</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Records</Table.Th>
                {results && <Table.Th style={{ textAlign: 'center' }}>Status</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {tables.map((table) => {
                const result = results?.find((r) => r.table === table.name);
                return (
                  <Table.Tr key={table.name}>
                    <Table.Td>{table.name}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      {table.count.toLocaleString()}
                    </Table.Td>
                    {results && (
                      <Table.Td style={{ textAlign: 'center' }}>
                        {result?.success ? (
                          <Badge color="green" leftSection={<IconCheck size={12} />}>
                            Exported
                          </Badge>
                        ) : result?.error ? (
                          <Badge color="red" leftSection={<IconX size={12} />}>
                            {result.error}
                          </Badge>
                        ) : (
                          <Badge color="gray">Pending</Badge>
                        )}
                      </Table.Td>
                    )}
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Stack>
      </Paper>

      {results && (
        <Alert
          color={failCount > 0 ? 'red' : 'green'}
          icon={failCount > 0 ? <IconX size={16} /> : <IconCheck size={16} />}
        >
          Export completed: {successCount} tables exported successfully
          {failCount > 0 && `, ${failCount} failed`}
        </Alert>
      )}
    </Stack>
  );
}
