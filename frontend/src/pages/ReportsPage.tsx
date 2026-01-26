import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack,
  Text,
  Badge,
  Table,
  Group,
  Button,
  Loader,
  Alert,
  ActionIcon,
  Anchor,
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
  IconChevronDown,
  IconChevronRight,
  IconCircleCheck,
} from '@tabler/icons-react';
import { EventsOn } from '@wailsjs/runtime/runtime';
import { StartReportGeneration, RefreshReport, GetReportNames } from '@app';
import { Log, LogErr } from '@/utils';
import { useTabContext } from '@/stores';
import { TabView, type Tab } from '@/components/TabView';

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
  checks?: string[];
  error?: string;
}

interface ReportState {
  loading: boolean;
  data: ReportCategory | null;
  error: string | null;
}

const iconMap: Record<string, React.ReactNode> = {
  IconSend: <IconSend size={16} />,
  IconBook: <IconBook size={16} />,
  IconFolder: <IconFolder size={16} />,
  IconBuilding: <IconBuilding size={16} />,
  IconNote: <IconNote size={16} />,
  IconAlertTriangle: <IconAlertTriangle size={16} />,
  IconHistory: <IconHistory size={16} />,
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
  const normalizedDateString = dateString.includes('T')
    ? dateString
    : dateString.replace(' ', 'T') + 'Z';
  const date = new Date(normalizedDateString);
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
  const { setPageTabs } = useTabContext();

  const [reportNames, setReportNames] = useState<string[]>([]);
  const [reportStates, setReportStates] = useState<Record<string, ReportState>>({});
  const [initializing, setInitializing] = useState(true);

  const updateReportState = useCallback((name: string, updates: Partial<ReportState>) => {
    setReportStates((prev) => ({
      ...prev,
      [name]: { ...prev[name], ...updates },
    }));
  }, []);

  const handleReportReady = useCallback(
    (category: ReportCategory) => {
      Log('Report ready:', category.name, 'issues:', category.count);
      updateReportState(category.name, {
        loading: false,
        data: category,
        error: category.error || null,
      });
    },
    [updateReportState]
  );

  const initializeReports = useCallback(async () => {
    try {
      const names = await GetReportNames();
      setReportNames(names);
      setPageTabs('reports', names);

      const initialStates: Record<string, ReportState> = {};
      for (const name of names) {
        initialStates[name] = { loading: true, data: null, error: null };
      }
      setReportStates(initialStates);
      setInitializing(false);

      await StartReportGeneration();
      Log('Report generation started for', names.length, 'reports');
    } catch (err) {
      LogErr('Failed to start report generation:', err);
      setInitializing(false);
    }
  }, [setPageTabs]);

  const handleRetry = useCallback(
    async (name: string) => {
      updateReportState(name, { loading: true, error: null });
      try {
        await RefreshReport(name);
      } catch (err) {
        LogErr('Failed to refresh report:', name, err);
        updateReportState(name, { loading: false, error: String(err) });
      }
    },
    [updateReportState]
  );

  useEffect(() => {
    const unsubscribe = EventsOn('report:ready', handleReportReady);
    return () => {
      unsubscribe();
    };
  }, [handleReportReady]);

  useEffect(() => {
    initializeReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleReload() {
      initializeReports();
    }
    window.addEventListener('reloadCurrentView', handleReload);
    return () => window.removeEventListener('reloadCurrentView', handleReload);
  }, [initializeReports]);

  const handleNavigateEntity = (entityType: string, entityID: number) => {
    switch (entityType) {
      case 'work':
        navigate(`/works/${entityID}`);
        break;
      case 'submission':
        navigate(`/submissions/${entityID}`);
        break;
      case 'organization':
        navigate(`/organizations/${entityID}`);
        break;
      case 'collection':
        navigate(`/collections/${entityID}`);
        break;
      case 'note':
        break;
      default:
        break;
    }
  };

  const renderRecentChanges = (report: ReportCategory) => (
    <Stack gap="md">
      <Group justify="flex-end">
        <Button
          variant="light"
          leftSection={<IconRefresh size={16} />}
          onClick={() => handleRetry('Recent Changes')}
          loading={reportStates['Recent Changes']?.loading}
        >
          Refresh
        </Button>
      </Group>

      {report.issues.length === 0 ? (
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
            {report.issues.map((issue, idx) => (
              <Table.Tr
                key={`${issue.entityType}-${issue.entityID}-${idx}`}
                style={{ cursor: issue.entityType !== 'note' ? 'pointer' : 'default' }}
                onClick={() =>
                  issue.entityType !== 'note' &&
                  handleNavigateEntity(issue.entityType, issue.entityID)
                }
              >
                <Table.Td>
                  <Badge
                    size="sm"
                    color={entityTypeColor[issue.entityType] || 'gray'}
                    leftSection={entityTypeIcon[issue.entityType]}
                    variant="light"
                  >
                    {issue.entityType}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500} lineClamp={1}>
                    {issue.entityName || '(unnamed)'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {formatRelativeTime(issue.description)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {issue.entityType !== 'note' && (
                    <ActionIcon
                      variant="subtle"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigateEntity(issue.entityType, issue.entityID);
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
    </Stack>
  );

  const [checksCollapsed, setChecksCollapsed] = useState<Record<string, boolean>>({});

  const renderChecks = (report: ReportCategory) => {
    if (!report.checks || report.checks.length === 0) return null;
    const isCollapsed = checksCollapsed[report.name] ?? false;
    return (
      <Stack gap="xs" mb="md">
        <Group
          gap="xs"
          style={{ cursor: 'pointer' }}
          onClick={() => setChecksCollapsed((prev) => ({ ...prev, [report.name]: !isCollapsed }))}
        >
          {isCollapsed ? <IconChevronRight size={16} /> : <IconChevronDown size={16} />}
          <Text size="sm" fw={500}>
            Checks Performed ({report.checks.length})
          </Text>
        </Group>
        {!isCollapsed && (
          <Stack gap={4} ml="md">
            {report.checks.map((check, idx) => (
              <Group key={idx} gap="xs">
                <IconCircleCheck size={14} color="var(--mantine-color-green-6)" />
                <Text size="sm" c="dimmed">
                  {check}
                </Text>
              </Group>
            ))}
          </Stack>
        )}
      </Stack>
    );
  };

  const renderCategoryIssues = (report: ReportCategory) => (
    <>
      {renderChecks(report)}
      {report.issues.length === 0 ? (
        <Alert color="green" icon={<IconCheck size={16} />}>
          No issues found in {report.name}
        </Alert>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Entity</Table.Th>
              <Table.Th>Issue</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {report.issues.map((issue) => (
              <Table.Tr key={`${issue.entityType}-${issue.id}`}>
                <Table.Td>
                  {['work', 'submission', 'organization', 'collection'].includes(
                    issue.entityType
                  ) ? (
                    <Anchor
                      size="sm"
                      fw={500}
                      onClick={() => handleNavigateEntity(issue.entityType, issue.entityID)}
                      style={{ cursor: 'pointer' }}
                    >
                      {issue.entityName}
                    </Anchor>
                  ) : (
                    <Text size="sm" fw={500}>
                      {issue.entityName}
                    </Text>
                  )}
                  <Text size="xs" c="dimmed">
                    {issue.entityType} #{issue.entityID}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{issue.description}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </>
  );

  const renderReportContent = (name: string) => {
    const state = reportStates[name];

    if (!state || state.loading) {
      return (
        <Stack align="center" justify="center" h={200}>
          <Loader />
          <Text size="sm" c="dimmed">
            Generating {name} report...
          </Text>
        </Stack>
      );
    }

    if (state.error) {
      return (
        <Stack align="center" justify="center" h={200} gap="md">
          <Alert color="red" icon={<IconAlertTriangle size={16} />} title="Error">
            {state.error}
          </Alert>
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => handleRetry(name)}
          >
            Retry
          </Button>
        </Stack>
      );
    }

    if (!state.data) {
      return (
        <Alert color="yellow" icon={<IconAlertTriangle size={16} />}>
          No data available
        </Alert>
      );
    }

    if (name === 'Recent Changes') {
      return renderRecentChanges(state.data);
    }

    return renderCategoryIssues(state.data);
  };

  if (initializing) {
    return (
      <Stack align="center" justify="center" h="100%">
        <Loader />
        <Text size="sm" c="dimmed">
          Initializing reports...
        </Text>
      </Stack>
    );
  }

  const tabs: Tab[] = reportNames.map((name) => {
    const state = reportStates[name];
    const icon = state?.data?.icon || 'IconAlertTriangle';
    const count = state?.data?.count || 0;

    return {
      value: name,
      label: name,
      icon: iconMap[icon] || <IconAlertTriangle size={16} />,
      content: renderReportContent(name),
      badge: name !== 'Recent Changes' ? count : undefined,
    };
  });

  return <TabView pageName="reports" tabs={tabs} defaultTab="Recent Changes" />;
}
