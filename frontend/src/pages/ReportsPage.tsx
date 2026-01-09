import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stack, Text, Badge, Table, Group, Button, Loader, Alert, ActionIcon } from '@mantine/core';
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
import { GetReportByName, GetReportCategories, GetRecentlyChanged } from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
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
  // Handle both ISO format (2026-01-05T22:38:09-05:00) and SQLite format (2026-01-06 03:27:20)
  // SQLite CURRENT_TIMESTAMP is UTC but lacks 'Z' suffix, so append it
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

  // Try to restore from sessionStorage
  const [reports, setReports] = useState<ReportCategory[]>(() => {
    const cached = sessionStorage.getItem('reports-cache');
    return cached ? JSON.parse(cached) : [];
  });
  const [recentChanges, setRecentChanges] = useState<models.RecentChange[]>(() => {
    const cached = sessionStorage.getItem('recent-changes-cache');
    return cached ? JSON.parse(cached) : [];
  });

  // Initialize loading states based on cached data
  const hasCachedData = reports.length > 0 && recentChanges.length > 0;
  const [loading, setLoading] = useState(!hasCachedData);
  const [reportsLoading, setReportsLoading] = useState(!hasCachedData);

  useEffect(() => {
    // If we have cached data, don't reload
    if (hasCachedData) {
      Log('Using cached reports');
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // Load recent changes immediately (fast)
        const changesData = await GetRecentlyChanged(50);
        if (cancelled) return;
        setRecentChanges(changesData || []);
        sessionStorage.setItem('recent-changes-cache', JSON.stringify(changesData || []));
        setLoading(false); // Show the UI immediately

        // Load all reports in background
        setReportsLoading(true);
        const categories = await GetReportCategories();
        if (cancelled) return;
        setReports(categories || []);

        const tabNames = [
          'recently-changed',
          ...(categories?.map((c: ReportCategory) => c.name) || []),
        ];
        setPageTabs('reports', tabNames);

        Log('Recent changes loaded:', changesData?.length || 0);
        Log('Report categories loaded:', categories?.length || 0);

        // Now load full details for all reports in background
        const fullReports = await Promise.all(
          (categories || []).map((cat) => GetReportByName(cat.name))
        );
        if (cancelled) return;
        setReports(fullReports);
        sessionStorage.setItem('reports-cache', JSON.stringify(fullReports));
        setReportsLoading(false);

        Log('All reports loaded with details');
      } catch (err) {
        if (cancelled) return;
        LogErr('Failed to load reports:', err);
        setLoading(false);
        setReportsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [setPageTabs, hasCachedData]);

  const loadData = useCallback(async () => {
    // Clear cache on manual reload
    sessionStorage.removeItem('reports-cache');
    sessionStorage.removeItem('recent-changes-cache');

    setLoading(true);
    try {
      // Load recent changes immediately (fast)
      const changesData = await GetRecentlyChanged(50);
      setRecentChanges(changesData || []);
      sessionStorage.setItem('recent-changes-cache', JSON.stringify(changesData || []));
      setLoading(false); // Show the UI immediately

      // Load all reports in background
      setReportsLoading(true);
      const categories = await GetReportCategories();
      setReports(categories || []);

      const tabNames = [
        'recently-changed',
        ...(categories?.map((c: ReportCategory) => c.name) || []),
      ];
      setPageTabs('reports', tabNames);

      Log('Recent changes loaded:', changesData?.length || 0);
      Log('Report categories loaded:', categories?.length || 0);

      // Now load full details for all reports in background
      const fullReports = await Promise.all(
        (categories || []).map((cat) => GetReportByName(cat.name))
      );
      setReports(fullReports);
      sessionStorage.setItem('reports-cache', JSON.stringify(fullReports));
      setReportsLoading(false);

      Log('All reports loaded with details');
    } catch (err) {
      LogErr('Failed to load reports:', err);
      setLoading(false);
      setReportsLoading(false);
    }
  }, [setPageTabs]);

  // Reload on Cmd+R
  useEffect(() => {
    function handleReload() {
      loadData();
    }
    window.addEventListener('reloadCurrentView', handleReload);
    return () => window.removeEventListener('reloadCurrentView', handleReload);
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

  const renderRecentlyChanged = () => (
    <Stack gap="md">
      <Group justify="flex-end">
        <Button
          variant="light"
          leftSection={<IconRefresh size={16} />}
          onClick={loadData}
          loading={loading}
        >
          Refresh
        </Button>
      </Group>

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
    </Stack>
  );

  const renderCategoryIssues = (cat: ReportCategory) => {
    if (reportsLoading) {
      return (
        <Stack align="center" justify="center" h={200}>
          <Loader />
          <Text size="sm" c="dimmed">
            Loading report details...
          </Text>
        </Stack>
      );
    }

    return (
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
  };

  if (loading) {
    return (
      <Stack align="center" justify="center" h="100%">
        <Loader />
      </Stack>
    );
  }

  // Build tabs array
  const tabs: Tab[] = [
    {
      value: 'recently-changed',
      label: 'Recently Changed',
      icon: <IconHistory size={16} />,
      content: renderRecentlyChanged(),
    },
    ...reports.map((cat) => ({
      value: cat.name,
      label: cat.name,
      icon: iconMap[cat.icon] || <IconAlertTriangle size={16} />,
      content: renderCategoryIssues(cat),
    })),
  ];

  return <TabView pageName="reports" tabs={tabs} defaultTab="recently-changed" />;
}
