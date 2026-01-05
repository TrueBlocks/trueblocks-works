import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack,
  Title,
  Text,
  Paper,
  Tabs,
  Badge,
  Table,
  Group,
  Button,
  Loader,
  Alert,
  ActionIcon,
} from '@mantine/core';
import {
  IconSend,
  IconBook,
  IconFolder,
  IconBuilding,
  IconNote,
  IconAlertTriangle,
  IconRefresh,
  IconExternalLink,
  IconCheck,
} from '@tabler/icons-react';
import { GetReports } from '@wailsjs/go/main/App';
import { Log, LogErr } from '@/utils';

interface ReportIssue {
  id: number;
  description: string;
  entityType: string;
  entityID: number;
  entityName: string;
}

interface ReportCategory {
  name: string;
  icon: string;
  issues: ReportIssue[];
  count: number;
}

interface ReportsResult {
  categories: ReportCategory[];
  totalCount: number;
}

const iconMap: Record<string, React.ReactNode> = {
  IconSend: <IconSend size={16} />,
  IconBook: <IconBook size={16} />,
  IconFolder: <IconFolder size={16} />,
  IconBuilding: <IconBuilding size={16} />,
  IconNote: <IconNote size={16} />,
  IconAlertTriangle: <IconAlertTriangle size={16} />,
};

export function ReportsPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await GetReports();
      setReports(data);
      Log('Reports loaded:', data);
      if (data.categories.length > 0) {
        setActiveTab((prev) => prev || data.categories[0].name);
      }
    } catch (err) {
      LogErr('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleNavigate = (issue: ReportIssue) => {
    switch (issue.entityType) {
      case 'work':
        navigate(`/works/${issue.entityID}`);
        break;
      case 'submission':
        navigate(`/submissions/${issue.entityID}`);
        break;
      case 'organization':
        navigate(`/organizations/${issue.entityID}`);
        break;
      case 'collection':
        navigate(`/collections`);
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <Stack align="center" justify="center" h="100%">
        <Loader />
      </Stack>
    );
  }

  if (!reports) {
    return (
      <Stack>
        <Title order={2}>Reports</Title>
        <Alert color="red">Failed to load reports</Alert>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Data Consistency Reports</Title>
          <Text size="sm" c="dimmed">
            {reports.totalCount === 0
              ? 'All checks passed!'
              : `${reports.totalCount} issue${reports.totalCount === 1 ? '' : 's'} found`}
          </Text>
        </div>
        <Button
          variant="light"
          leftSection={<IconRefresh size={16} />}
          onClick={loadReports}
          loading={loading}
        >
          Refresh
        </Button>
      </Group>

      {reports.totalCount === 0 ? (
        <Alert color="green" icon={<IconCheck size={16} />}>
          All data consistency checks passed. No issues found.
        </Alert>
      ) : (
        <Paper withBorder>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              {reports.categories.map((cat) => (
                <Tabs.Tab
                  key={cat.name}
                  value={cat.name}
                  leftSection={iconMap[cat.icon] || <IconAlertTriangle size={16} />}
                  rightSection={
                    cat.count > 0 ? (
                      <Badge size="sm" color="red" variant="filled">
                        {cat.count}
                      </Badge>
                    ) : (
                      <Badge size="sm" color="green" variant="light">
                        ✓
                      </Badge>
                    )
                  }
                >
                  {cat.name}
                </Tabs.Tab>
              ))}
            </Tabs.List>

            {reports.categories.map((cat) => (
              <Tabs.Panel key={cat.name} value={cat.name} p="md">
                {cat.issues.length === 0 ? (
                  <Alert color="green" icon={<IconCheck size={16} />}>
                    No issues found in {cat.name}
                  </Alert>
                ) : (
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Entity</Table.Th>
                        <Table.Th>Issue</Table.Th>
                        <Table.Th style={{ width: 60 }} />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {cat.issues.map((issue) => (
                        <Table.Tr key={`${issue.entityType}-${issue.id}`}>
                          <Table.Td>
                            <Text size="sm" fw={500}>
                              {issue.entityName}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {issue.entityType} #{issue.entityID}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{issue.description}</Text>
                          </Table.Td>
                          <Table.Td>
                            {['work', 'submission', 'organization', 'collection'].includes(
                              issue.entityType
                            ) && (
                              <ActionIcon
                                variant="subtle"
                                onClick={() => handleNavigate(issue)}
                                title="Go to record"
                              >
                                <IconExternalLink size={16} />
                              </ActionIcon>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Tabs.Panel>
            ))}
          </Tabs>
        </Paper>
      )}
    </Stack>
  );
}
