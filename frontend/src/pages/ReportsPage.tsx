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
  IconHistory,
} from '@tabler/icons-react';
import { GetReports, GetRecentlyChanged } from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
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

const entityTypeIcon: Record<string, React.ReactNode> = {
  work: <IconBook size={14} />,
  organization: <IconBuilding size={14} />,
  submission: <IconSend size={14} />,
  note: <IconNote size={14} />,
  collection: <IconFolder size={14} />,
};

const entityTypeColor: Record<string, string> = {
  work: 'blue',
  organization: 'green',
  submission: 'orange',
  note: 'grape',
  collection: 'cyan',
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString();
}

export function ReportsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string | null>('recently-changed');
  const [reports, setReports] = useState<ReportsResult | null>(null);
  const [recentChanges, setRecentChanges] = useState<models.RecentChange[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reportsData, changesData] = await Promise.all([GetReports(), GetRecentlyChanged(50)]);
      setReports(reportsData);
      setRecentChanges(changesData || []);
      Log('Reports loaded:', reportsData);
      Log('Recent changes loaded:', changesData?.length || 0);
    } catch (err) {
      LogErr('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleNavigateIssue = (issue: ReportIssue) => {
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

  const handleNavigateChange = (change: models.RecentChange) => {
    switch (change.entityType) {
      case 'work':
        navigate(`/works/${change.entityID}`);
        break;
      case 'submission':
        navigate(`/submissions/${change.entityID}`);
        break;
      case 'organization':
        navigate(`/organizations/${change.entityID}`);
        break;
      case 'collection':
        navigate(`/collections/${change.entityID}`);
        break;
      case 'note':
        // Notes don't have their own page
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

  const renderRecentlyChanged = () => (
    <>
      {recentChanges.length === 0 ? (
        <Alert color="blue" icon={<IconHistory size={16} />}>
          No recent changes found.
        </Alert>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 120 }}>Type</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th style={{ width: 150 }}>Modified</Table.Th>
              <Table.Th style={{ width: 60 }} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {recentChanges.map((change, idx) => (
              <Table.Tr
                key={`${change.entityType}-${change.entityID}-${idx}`}
                style={{ cursor: change.entityType !== 'note' ? 'pointer' : 'default' }}
                onClick={() => change.entityType !== 'note' && handleNavigateChange(change)}
              >
                <Table.Td>
                  <Badge
                    size="sm"
                    color={entityTypeColor[change.entityType] || 'gray'}
                    leftSection={entityTypeIcon[change.entityType]}
                    variant="light"
                  >
                    {change.entityType}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500} lineClamp={1}>
                    {change.name || '(unnamed)'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {formatRelativeTime(change.modifiedAt)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {change.entityType !== 'note' && (
                    <ActionIcon
                      variant="subtle"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigateChange(change);
                      }}
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
    </>
  );

  const renderCategoryIssues = (cat: ReportCategory) => (
    <>
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
                      onClick={() => handleNavigateIssue(issue)}
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
    </>
  );

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Reports</Title>
        <Button
          variant="light"
          leftSection={<IconRefresh size={16} />}
          onClick={loadData}
          loading={loading}
        >
          Refresh
        </Button>
      </Group>

      <Paper withBorder>
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="recently-changed" leftSection={<IconHistory size={16} />}>
              Recently Changed
              {recentChanges.length > 0 && (
                <Badge size="sm" variant="light" ml="xs">
                  {recentChanges.length}
                </Badge>
              )}
            </Tabs.Tab>
            {reports?.categories.map((cat) => (
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

          <Tabs.Panel value="recently-changed" p="md">
            {renderRecentlyChanged()}
          </Tabs.Panel>

          {reports?.categories.map((cat) => (
            <Tabs.Panel key={cat.name} value={cat.name} p="md">
              {renderCategoryIssues(cat)}
            </Tabs.Panel>
          ))}
        </Tabs>
      </Paper>
    </Stack>
  );
}
