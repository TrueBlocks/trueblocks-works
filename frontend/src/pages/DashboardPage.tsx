import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack,
  Grid,
  Title,
  Text,
  Group,
  Paper,
  Badge,
  Loader,
  Alert,
  ThemeIcon,
} from '@mantine/core';
import {
  IconBook2,
  IconBuilding,
  IconSend,
  IconFolder,
  IconClock,
  IconTrophy,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { GetDashboardStats } from '@wailsjs/go/main/App';
import { main } from '@wailsjs/go/models';
import { DashboardCard, StatRow } from '@/components/DashboardCard';
import { Log, LogErr } from '@/utils';

const COLORS = {
  works: 'blue',
  organizations: 'green',
  submissions: 'orange',
  collections: 'violet',
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
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<main.DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cardPages, setCardPages] = useState({
    works: 0,
    organizations: 0,
    submissions: 0,
    collections: 0,
  });

  const loadStats = useCallback(async () => {
    try {
      const data = await GetDashboardStats();
      setStats(data);
      Log('Dashboard stats loaded');
    } catch (err) {
      LogErr('Failed to load dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <Stack align="center" justify="center" h="100%">
        <Loader size="lg" />
      </Stack>
    );
  }

  if (!stats) {
    return (
      <Alert color="red" title="Error">
        Failed to load dashboard statistics
      </Alert>
    );
  }

  const worksPages = [
    {
      title: 'By Type',
      content: (
        <Stack gap={4}>
          <StatRow label="Total" value={stats.works.total} color={COLORS.works} />
          {Object.entries(stats.works.byType || {}).map(([type, count]) => (
            <StatRow
              key={type}
              label={type}
              value={count}
              onClick={() => navigate(`/works?type=${encodeURIComponent(type)}`)}
            />
          ))}
        </Stack>
      ),
    },
    {
      title: 'By Status',
      content: (
        <Stack gap={4}>
          {Object.entries(stats.works.byStatus || {}).map(([status, count]) => (
            <StatRow
              key={status}
              label={status}
              value={count}
              onClick={() => navigate(`/works?status=${encodeURIComponent(status)}`)}
            />
          ))}
        </Stack>
      ),
    },
    {
      title: 'By Quality',
      content: (
        <Stack gap={4}>
          {Object.entries(stats.works.byQuality || {}).map(([quality, count]) => (
            <StatRow
              key={quality}
              label={quality}
              value={count}
              onClick={() => navigate(`/works?quality=${encodeURIComponent(quality)}`)}
            />
          ))}
        </Stack>
      ),
    },
    {
      title: 'By Year',
      content: (
        <Stack gap={4}>
          {Object.entries(stats.works.byYear || {})
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 6)
            .map(([year, count]) => (
              <StatRow
                key={year}
                label={year}
                value={count}
                onClick={() => navigate(`/works?year=${encodeURIComponent(year)}`)}
              />
            ))}
        </Stack>
      ),
    },
  ];

  const orgsPages = [
    {
      title: 'By Status',
      content: (
        <Stack gap={4}>
          <StatRow label="Total" value={stats.organizations.total} color={COLORS.organizations} />
          {Object.entries(stats.organizations.byStatus || {}).map(([status, count]) => (
            <StatRow
              key={status}
              label={status}
              value={count}
              onClick={() => navigate(`/organizations?status=${encodeURIComponent(status)}`)}
            />
          ))}
        </Stack>
      ),
    },
    {
      title: 'By Type',
      content: (
        <Stack gap={4}>
          {Object.entries(stats.organizations.byType || {}).map(([type, count]) => (
            <StatRow
              key={type}
              label={type}
              value={count}
              onClick={() => navigate(`/organizations?type=${encodeURIComponent(type)}`)}
            />
          ))}
        </Stack>
      ),
    },
    {
      title: 'Top Submitted',
      content: (
        <Stack gap={4}>
          {(stats.organizations.topSubmitted || []).map((org, idx) => (
            <StatRow key={idx} label={org.name} value={`${org.count} subs`} />
          ))}
        </Stack>
      ),
    },
  ];

  const submissionsPages = [
    {
      title: 'By Response',
      content: (
        <Stack gap={4}>
          <StatRow label="Pending" value={stats.submissions.pending} color="orange" />
          <StatRow
            label="This Year"
            value={stats.submissions.thisYear}
            color={COLORS.submissions}
          />
          {Object.entries(stats.submissions.byResponse || {}).map(([response, count]) => (
            <StatRow
              key={response}
              label={response}
              value={count}
              onClick={() => navigate(`/submissions?response=${encodeURIComponent(response)}`)}
            />
          ))}
        </Stack>
      ),
    },
    {
      title: 'Timeline',
      content: (
        <Stack gap={4}>
          {Object.entries(stats.submissions.byMonth || {})
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 6)
            .map(([month, count]) => (
              <StatRow key={month} label={month} value={count} />
            ))}
        </Stack>
      ),
    },
    {
      title: 'Success Rate',
      content: (
        <Stack gap="md" align="center" justify="center" style={{ flex: 1 }}>
          <Text size="xl" fw={700} c={COLORS.submissions}>
            {stats.submissions.acceptRate?.toFixed(1) || 0}%
          </Text>
          <Text size="sm" c="dimmed">
            Overall acceptance rate
          </Text>
        </Stack>
      ),
    },
  ];

  const collectionsPages = [
    {
      title: 'Overview',
      content: (
        <Stack gap={4}>
          <StatRow label="Total" value={stats.collections.total} color={COLORS.collections} />
          <StatRow label="Status Lists" value={stats.collections.statusLists} />
          <StatRow label="Regular" value={stats.collections.regular} />
        </Stack>
      ),
    },
    {
      title: 'Largest Collections',
      content: (
        <Stack gap={4}>
          {(stats.collections.largest || []).map((coll, idx) => (
            <StatRow key={idx} label={coll.name} value={`${coll.count} items`} />
          ))}
        </Stack>
      ),
    },
  ];

  return (
    <Stack gap="lg">
      <Title order={2}>Dashboard</Title>

      {/* Year Progress Banner */}
      <Paper withBorder p="md" radius="md">
        <Group justify="space-between">
          <Group gap="lg">
            <ThemeIcon size="lg" variant="light" color="blue">
              <IconTrophy size={20} />
            </ThemeIcon>
            <div>
              <Text size="sm" c="dimmed">
                {stats.yearProgress.year} Progress
              </Text>
              <Group gap="md">
                <Text fw={600}>{stats.yearProgress.submissions} submissions</Text>
                <Text c="dimmed">|</Text>
                <Text fw={600} c="green">
                  {stats.yearProgress.acceptances} acceptances
                </Text>
                <Text c="dimmed">|</Text>
                <Text fw={600} c="blue">
                  {stats.yearProgress.successRate?.toFixed(1) || 0}% success rate
                </Text>
              </Group>
            </div>
          </Group>
          {stats.pendingAlerts && stats.pendingAlerts.length > 0 && (
            <Badge color="orange" variant="light" size="lg" leftSection={<IconClock size={14} />}>
              {stats.pendingAlerts.length} pending 60+ days
            </Badge>
          )}
        </Group>
      </Paper>

      {/* Main Cards Grid */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <DashboardCard
            title="Works"
            icon={<IconBook2 size={20} />}
            color={COLORS.works}
            pages={worksPages}
            currentPage={cardPages.works}
            onPageChange={(p) => setCardPages((prev) => ({ ...prev, works: p }))}
            onViewAll={() => navigate('/works')}
            sparkline={stats.works.sparkline}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <DashboardCard
            title="Organizations"
            icon={<IconBuilding size={20} />}
            color={COLORS.organizations}
            pages={orgsPages}
            currentPage={cardPages.organizations}
            onPageChange={(p) => setCardPages((prev) => ({ ...prev, organizations: p }))}
            onViewAll={() => navigate('/organizations')}
            sparkline={stats.organizations.sparkline}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <DashboardCard
            title="Submissions"
            icon={<IconSend size={20} />}
            color={COLORS.submissions}
            pages={submissionsPages}
            currentPage={cardPages.submissions}
            onPageChange={(p) => setCardPages((prev) => ({ ...prev, submissions: p }))}
            onViewAll={() => navigate('/submissions')}
            sparkline={stats.submissions.sparkline}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <DashboardCard
            title="Collections"
            icon={<IconFolder size={20} />}
            color={COLORS.collections}
            pages={collectionsPages}
            currentPage={cardPages.collections}
            onPageChange={(p) => setCardPages((prev) => ({ ...prev, collections: p }))}
            onViewAll={() => navigate('/collections')}
            sparkline={stats.collections.sparkline}
          />
        </Grid.Col>
      </Grid>

      {/* Recently Added Section */}
      {stats.recentItems && stats.recentItems.length > 0 && (
        <Paper withBorder p="md" radius="md">
          <Group gap="xs" mb="sm">
            <IconClock size={18} />
            <Title order={5}>Recently Added</Title>
          </Group>
          <Stack gap="xs">
            {stats.recentItems.map((item, idx) => (
              <Group
                key={idx}
                justify="space-between"
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  switch (item.entityType) {
                    case 'work':
                      navigate(`/works/${item.entityID}`);
                      break;
                    case 'organization':
                      navigate(`/organizations/${item.entityID}`);
                      break;
                    case 'submission':
                      navigate(`/submissions/${item.entityID}`);
                      break;
                    case 'collection':
                      navigate(`/collections/${item.entityID}`);
                      break;
                  }
                }}
              >
                <Group gap="xs">
                  <Badge
                    size="xs"
                    color={COLORS[item.entityType as keyof typeof COLORS] || 'gray'}
                    variant="light"
                  >
                    {item.entityType}
                  </Badge>
                  <Text size="sm">{item.name || '(unnamed)'}</Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {formatRelativeTime(item.createdAt)}
                </Text>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Pending Alerts */}
      {stats.pendingAlerts && stats.pendingAlerts.length > 0 && (
        <Paper withBorder p="md" radius="md" bg="orange.0">
          <Group gap="xs" mb="sm">
            <ThemeIcon size="sm" variant="light" color="orange">
              <IconAlertTriangle size={14} />
            </ThemeIcon>
            <Title order={5} c="orange.8">
              Submissions Waiting 60+ Days
            </Title>
          </Group>
          <Stack gap="xs">
            {stats.pendingAlerts.map((alert) => (
              <Group
                key={alert.submissionID}
                justify="space-between"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/submissions/${alert.submissionID}`)}
              >
                <Group gap="xs">
                  <Text size="sm" fw={500}>
                    {alert.workTitle}
                  </Text>
                  <Text size="sm" c="dimmed">
                    → {alert.orgName}
                  </Text>
                </Group>
                <Badge color="orange" variant="light">
                  {alert.daysWaiting} days
                </Badge>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
