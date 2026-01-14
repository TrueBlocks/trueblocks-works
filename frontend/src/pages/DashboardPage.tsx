import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack,
  Title,
  Text,
  Group,
  Paper,
  Loader,
  Alert,
  ThemeIcon,
  Box,
  Badge,
} from '@mantine/core';
import { BarChart, PieChart } from '@mantine/charts';
import {
  IconBook2,
  IconFolder,
  IconTrophy,
  IconClock,
  IconCalendar,
  IconChartPie,
} from '@tabler/icons-react';
import { GetDashboardStats, SetTableState, GetAppState, SetDashboardTimeframe } from '@app';
import { app, state } from '@models';
import { Log, LogErr } from '@/utils';

const CHART_COLORS = [
  'blue.6',
  'teal.6',
  'violet.6',
  'orange.6',
  'pink.6',
  'cyan.6',
  'grape.6',
  'lime.6',
  'indigo.6',
  'yellow.6',
];

/* HIDDEN: formatRelativeTime - preserved for future use
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
*/

interface TypeDataResult {
  data: { name: string; value: number; color: string }[];
  otherTypes: string[];
}

function prepareTypeData(byType: Record<string, number> | undefined): TypeDataResult {
  if (!byType) return { data: [], otherTypes: [] };
  const entries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const threshold = total * 0.03; // 3%
  const mainTypes: { name: string; value: number; color: string }[] = [];
  const otherTypes: string[] = [];
  let otherCount = 0;
  let colorIdx = 0;

  entries.forEach(([name, value]) => {
    if (value < threshold) {
      otherCount += value;
      otherTypes.push(name);
    } else {
      mainTypes.push({ name, value, color: CHART_COLORS[colorIdx % CHART_COLORS.length] });
      colorIdx++;
    }
  });

  if (otherCount > 0) {
    mainTypes.push({ name: 'Other', value: otherCount, color: 'gray.5' });
  }

  return { data: mainTypes, otherTypes };
}

type TimeframeCode = 'D' | 'W' | 'M' | 'Y' | 'All';

interface TimeframeFilterProps {
  value: string;
  onChange: (value: TimeframeCode) => void;
}

function TimeframeFilter({ value, onChange }: TimeframeFilterProps) {
  const options: { code: TimeframeCode; label: string }[] = [
    { code: 'D', label: 'day' },
    { code: 'W', label: 'week' },
    { code: 'M', label: 'month' },
    { code: 'Y', label: 'year' },
    { code: 'All', label: 'all' },
  ];

  return (
    <Group gap={4}>
      {options.map(({ code, label }, index) => (
        <>
          {index > 0 && (
            <Text size="sm" c="dimmed">
              |
            </Text>
          )}
          <Text
            key={code}
            component="button"
            size="sm"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: value === code ? 700 : 400,
              textDecoration: value === code ? 'underline' : 'none',
              color: 'var(--mantine-color-dimmed)',
            }}
            onClick={() => onChange(code)}
          >
            {label}
          </Text>
        </>
      ))}
    </Group>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<app.DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<string>('All');

  // Load persisted timeframe on mount
  useEffect(() => {
    GetAppState().then((appState) => {
      if (appState.dashboardTimeframe) {
        setTimeframe(appState.dashboardTimeframe);
      }
    });
  }, []);

  // Persist timeframe changes
  const handleTimeframeChange = useCallback((value: TimeframeCode) => {
    setTimeframe(value);
    SetDashboardTimeframe(value);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await GetDashboardStats(timeframe);
      setStats(data);
    } catch (err) {
      LogErr('Failed to load dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Reload on Cmd+R
  useEffect(() => {
    function handleReload() {
      loadStats();
    }
    window.addEventListener('reloadCurrentView', handleReload);
    return () => window.removeEventListener('reloadCurrentView', handleReload);
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

  // Prepare chart data
  const yearData = Object.entries(stats.works.byYear || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, count]) => ({ year, count }));

  // Works by year (not ideas)
  const worksYearData = Object.entries(stats.works.byYearWorks || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, count]) => ({ year, count }));

  // Ideas by year
  const ideasYearData = Object.entries(stats.works.byYearIdeas || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, count]) => ({ year, count }));

  // Calculate shared Y-axis max for Works vs Ideas comparison
  const worksMax = Math.max(0, ...worksYearData.map((d) => d.count));
  const ideasMax = Math.max(0, ...ideasYearData.map((d) => d.count));
  const yearChartMax = Math.max(worksMax, ideasMax);

  // Calculate total for percentage threshold
  const statusEntries = Object.entries(stats.works.byStatus || {});
  const statusTotal = statusEntries.reduce((sum, [, count]) => sum + count, 0);
  const statusThreshold = statusTotal * 0.03; // 3%

  const statusDataRaw = statusEntries.sort((a, b) => b[1] - a[1]);
  const statusData: { name: string; value: number; color: string }[] = [];
  const statusOtherStatuses: string[] = [];
  let statusOtherCount = 0;
  let colorIdx = 0;

  statusDataRaw.forEach(([name, value]) => {
    if (value < statusThreshold) {
      statusOtherCount += value;
      statusOtherStatuses.push(name);
    } else {
      statusData.push({ name, value, color: CHART_COLORS[colorIdx % CHART_COLORS.length] });
      colorIdx++;
    }
  });

  if (statusOtherCount > 0) {
    statusData.push({ name: 'Other', value: statusOtherCount, color: 'gray.5' });
  }

  const qualityData = Object.entries(stats.works.byQuality || {})
    .sort((a, b) => b[1] - a[1])
    .map(([quality, count]) => ({ quality, count }));

  // Split types into Works (not ending with " Idea") and Ideas (ending with " Idea")
  const byType = stats.works.byType || {};
  const worksTypes: Record<string, number> = {};
  const ideasTypes: Record<string, number> = {};
  Object.entries(byType).forEach(([name, count]) => {
    if (name.endsWith(' Idea')) {
      ideasTypes[name] = count;
    } else {
      worksTypes[name] = count;
    }
  });

  const worksTypeResult = prepareTypeData(worksTypes);
  const worksTypeData = worksTypeResult.data;
  const worksTypeOtherTypes = worksTypeResult.otherTypes;
  const worksTypeTotal = worksTypeData.reduce((sum, item) => sum + item.value, 0);

  const ideasTypeResult = prepareTypeData(ideasTypes);
  const ideasTypeData = ideasTypeResult.data;
  const ideasTypeOtherTypes = ideasTypeResult.otherTypes;
  const ideasTypeTotal = ideasTypeData.reduce((sum, item) => sum + item.value, 0);

  // Debug logging
  Log(
    `yearData: ${yearData.length} items, worksTypeData: ${worksTypeData.length}, ideasTypeData: ${ideasTypeData.length}`
  );
  Log(`byType raw: ${JSON.stringify(stats.works.byType)}`);
  if (yearData.length > 0) Log(`First year: ${JSON.stringify(yearData[0])}`);
  if (worksTypeData.length > 0) Log(`First worksType: ${JSON.stringify(worksTypeData[0])}`);
  if (ideasTypeData.length > 0) Log(`First ideasType: ${JSON.stringify(ideasTypeData[0])}`);

  // Prepare collections pie chart data with 3% threshold
  // Track collID for click navigation
  const bookCollectionsRaw = stats.collections.byTypeBook || [];
  const bookCollectionsTotalRaw = bookCollectionsRaw.reduce((sum, c) => sum + c.count, 0);
  const bookThreshold = bookCollectionsTotalRaw * 0.03;
  const bookCollectionsData: { name: string; value: number; color: string; collID?: number }[] = [];
  const bookOtherCollIDs: number[] = [];
  let bookOtherCount = 0;
  let bookColorIdx = 0;
  bookCollectionsRaw.forEach((coll) => {
    if (coll.count < bookThreshold) {
      bookOtherCount += coll.count;
      bookOtherCollIDs.push(coll.collID);
    } else {
      bookCollectionsData.push({
        name: coll.name,
        value: coll.count,
        color: CHART_COLORS[bookColorIdx % CHART_COLORS.length],
        collID: coll.collID,
      });
      bookColorIdx++;
    }
  });
  if (bookOtherCount > 0) {
    bookCollectionsData.push({ name: 'Other', value: bookOtherCount, color: 'gray.5' });
  }
  const bookCollectionsTotal = bookCollectionsData.reduce((sum, d) => sum + d.value, 0);

  const otherCollectionsRaw = stats.collections.byTypeOther || [];
  const otherCollectionsTotalRaw = otherCollectionsRaw.reduce((sum, c) => sum + c.count, 0);
  const otherThreshold = otherCollectionsTotalRaw * 0.03;
  const otherCollectionsData: { name: string; value: number; color: string; collID?: number }[] =
    [];
  const otherOtherCollIDs: number[] = [];
  let otherOtherCount = 0;
  let otherColorIdx = 0;
  otherCollectionsRaw.forEach((coll) => {
    if (coll.count < otherThreshold) {
      otherOtherCount += coll.count;
      otherOtherCollIDs.push(coll.collID);
    } else {
      otherCollectionsData.push({
        name: coll.name,
        value: coll.count,
        color: CHART_COLORS[otherColorIdx % CHART_COLORS.length],
        collID: coll.collID,
      });
      otherColorIdx++;
    }
  });
  if (otherOtherCount > 0) {
    otherCollectionsData.push({ name: 'Other', value: otherOtherCount, color: 'gray.5' });
  }
  const otherCollectionsTotal = otherCollectionsData.reduce((sum, d) => sum + d.value, 0);

  // Helper to navigate to works with specific filters
  const navigateToWorks = async (filters: Record<string, string[]>) => {
    const tableState = new state.TableState({
      search: '',
      sort: new state.ViewSort({
        primary: new state.SortColumn({ column: 'title', direction: 'asc' }),
        secondary: new state.SortColumn({ column: '', direction: '' }),
      }),
      page: 1,
      pageSize: 20,
      filters: filters,
      rangeFilters: {},
    });
    await SetTableState('works', tableState);
    navigate('/works');
  };

  // Collections click handlers
  const handleBookCollectionClick = (segment: { name: string; collID?: number }) => {
    if (segment.name === 'Other') {
      navigate('/collections');
    } else if (segment.collID) {
      navigate(`/collections/${segment.collID}`);
    }
  };

  const handleOtherCollectionClick = (segment: { name: string; collID?: number }) => {
    if (segment.name === 'Other') {
      navigate('/collections');
    } else if (segment.collID) {
      navigate(`/collections/${segment.collID}`);
    }
  };

  // Status click handler
  const handleStatusClick = (segment: { name: string }) => {
    if (segment.name === 'Other') {
      navigateToWorks({ status: statusOtherStatuses });
    } else {
      navigateToWorks({ status: [segment.name] });
    }
  };

  // Quality click handler
  const handleQualityClick = (entry: { quality: string }) => {
    navigateToWorks({ quality: [entry.quality] });
  };

  // Year click handlers (need to build type filter for all works or all ideas)
  const worksTypeNames = Object.keys(worksTypes);
  const ideasTypeNames = Object.keys(ideasTypes);

  const handleWorksYearClick = (entry: { year: string }) => {
    navigateToWorks({ year: [entry.year], type: worksTypeNames });
  };

  const handleIdeasYearClick = (entry: { year: string }) => {
    navigateToWorks({ year: [entry.year], type: ideasTypeNames });
  };

  // Type click handlers
  const handleWorksTypeClick = (segment: { name: string }) => {
    if (segment.name === 'Other') {
      navigateToWorks({ type: worksTypeOtherTypes });
    } else {
      navigateToWorks({ type: [segment.name] });
    }
  };

  const handleIdeasTypeClick = (segment: { name: string }) => {
    if (segment.name === 'Other') {
      navigateToWorks({ type: ideasTypeOtherTypes });
    } else {
      navigateToWorks({ type: [segment.name] });
    }
  };

  return (
    <Box
      h="calc(100vh - 100px)"
      style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <Group justify="space-between" mb="md">
        <Title order={2}>Dashboard</Title>
        <TimeframeFilter value={timeframe} onChange={handleTimeframeChange} />
      </Group>

      {/* Year Progress Banner */}
      <Paper withBorder p="sm" radius="md" mb="md" style={{ flexShrink: 0 }}>
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

      {/* Main Cards - Two Rows */}
      <Box
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--mantine-spacing-md)',
          minHeight: 0,
        }}
      >
        {/* Top Row */}
        <Group grow align="stretch" style={{ flex: 1, minHeight: 0 }}>
          {/* Card 1: Collections */}
          <Paper
            withBorder
            radius="md"
            p="md"
            style={{ display: 'flex', flexDirection: 'column', flex: 1 }}
          >
            <Group gap="xs" mb="sm">
              <ThemeIcon size="sm" variant="light" color="violet">
                <IconFolder size={16} />
              </ThemeIcon>
              <Text size="sm" fw={600}>
                Collections
              </Text>
              <Text size="xs" c="dimmed" ml="auto">
                {stats.collections.total} total
              </Text>
            </Group>
            <Group
              style={{
                flex: 1,
                minHeight: 0,
                height: '100%',
              }}
              grow
              gap="md"
            >
              <Box style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Text size="xs" fw={500} ta="center" mb="xs">
                  Books
                </Text>
                <Box style={{ flex: 1, minHeight: 200 }}>
                  {bookCollectionsData.length > 0 ? (
                    <PieChart
                      h="100%"
                      data={bookCollectionsData}
                      withLabels
                      labelsPosition="outside"
                      labelsType="value"
                      valueFormatter={(value) => {
                        const item = bookCollectionsData.find((d) => d.value === value);
                        return item?.name || String(value);
                      }}
                      withTooltip
                      tooltipDataSource="segment"
                      tooltipProps={{
                        content: ({ payload }) => {
                          if (!payload || !payload[0]) return null;
                          const data = payload[0].payload;
                          const pct = ((data.value / bookCollectionsTotal) * 100).toFixed(1);
                          return (
                            <Paper p="xs" withBorder shadow="sm">
                              <Text size="xs">Count: {data.value}</Text>
                              <Text size="xs">Pct: {pct}%</Text>
                            </Paper>
                          );
                        },
                      }}
                      pieProps={{
                        onClick: (_, index) => {
                          const segment = bookCollectionsData[index];
                          handleBookCollectionClick(segment);
                        },
                        style: { cursor: 'pointer' },
                      }}
                    />
                  ) : (
                    <Text c="dimmed" ta="center">
                      No book collections
                    </Text>
                  )}
                </Box>
              </Box>
              <Box style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Text size="xs" fw={500} ta="center" mb="xs">
                  Other
                </Text>
                <Box style={{ flex: 1, minHeight: 200 }}>
                  {otherCollectionsData.length > 0 ? (
                    <PieChart
                      h="100%"
                      data={otherCollectionsData}
                      withLabels
                      labelsPosition="outside"
                      labelsType="value"
                      valueFormatter={(value) => {
                        const item = otherCollectionsData.find((d) => d.value === value);
                        return item?.name || String(value);
                      }}
                      withTooltip
                      tooltipDataSource="segment"
                      tooltipProps={{
                        content: ({ payload }) => {
                          if (!payload || !payload[0]) return null;
                          const data = payload[0].payload;
                          const pct = ((data.value / otherCollectionsTotal) * 100).toFixed(1);
                          return (
                            <Paper p="xs" withBorder shadow="sm">
                              <Text size="xs">Count: {data.value}</Text>
                              <Text size="xs">Pct: {pct}%</Text>
                            </Paper>
                          );
                        },
                      }}
                      pieProps={{
                        onClick: (_, index) => {
                          const segment = otherCollectionsData[index];
                          handleOtherCollectionClick(segment);
                        },
                        style: { cursor: 'pointer' },
                      }}
                    />
                  ) : (
                    <Text c="dimmed" ta="center">
                      No other collections
                    </Text>
                  )}
                </Box>
              </Box>
            </Group>
          </Paper>

          {/* Card 2: Years (Works vs. Ideas) */}
          <Paper
            withBorder
            radius="md"
            p="md"
            style={{ display: 'flex', flexDirection: 'column', flex: 1 }}
          >
            <Group gap="xs" mb="sm">
              <ThemeIcon size="sm" variant="light" color="blue">
                <IconCalendar size={16} />
              </ThemeIcon>
              <Text size="sm" fw={600}>
                Years (Works vs. Ideas)
              </Text>
              <Text size="xs" c="dimmed" ml="auto">
                {stats.works.total} total
              </Text>
            </Group>
            <Group
              style={{
                flex: 1,
                minHeight: 0,
                height: '100%',
              }}
              grow
              gap="md"
            >
              <Box style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Text size="xs" fw={500} ta="center" mb="xs">
                  Works
                </Text>
                <Box style={{ flex: 1, minHeight: 150 }}>
                  {worksYearData.length > 0 ? (
                    <BarChart
                      h="100%"
                      data={worksYearData}
                      dataKey="year"
                      series={[{ name: 'count', color: 'blue.6' }]}
                      tickLine="y"
                      gridAxis="y"
                      yAxisProps={{ domain: [0, yearChartMax] }}
                      tooltipProps={{
                        content: ({ payload, label }) => {
                          if (!payload || !payload[0]) return null;
                          return (
                            <Paper p="xs" withBorder shadow="sm">
                              <Text size="xs" fw={500}>
                                {label}
                              </Text>
                              <Text size="xs">Count: {payload[0].value}</Text>
                            </Paper>
                          );
                        },
                      }}
                      barProps={{
                        onClick: (data: unknown) => {
                          const d = data as { year?: string };
                          if (d?.year) {
                            handleWorksYearClick({ year: d.year });
                          }
                        },
                        style: { cursor: 'pointer' },
                      }}
                    />
                  ) : (
                    <Text c="dimmed" ta="center">
                      No works data
                    </Text>
                  )}
                </Box>
              </Box>
              <Box style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Text size="xs" fw={500} ta="center" mb="xs">
                  Ideas
                </Text>
                <Box style={{ flex: 1, minHeight: 150 }}>
                  {ideasYearData.length > 0 ? (
                    <BarChart
                      h="100%"
                      data={ideasYearData}
                      dataKey="year"
                      series={[{ name: 'count', color: 'violet.6' }]}
                      tickLine="y"
                      gridAxis="y"
                      yAxisProps={{ domain: [0, yearChartMax] }}
                      tooltipProps={{
                        content: ({ payload, label }) => {
                          if (!payload || !payload[0]) return null;
                          return (
                            <Paper p="xs" withBorder shadow="sm">
                              <Text size="xs" fw={500}>
                                {label}
                              </Text>
                              <Text size="xs">Count: {payload[0].value}</Text>
                            </Paper>
                          );
                        },
                      }}
                      barProps={{
                        onClick: (data: unknown) => {
                          const d = data as { year?: string };
                          if (d?.year) {
                            handleIdeasYearClick({ year: d.year });
                          }
                        },
                        style: { cursor: 'pointer' },
                      }}
                    />
                  ) : (
                    <Text c="dimmed" ta="center">
                      No ideas data
                    </Text>
                  )}
                </Box>
              </Box>
            </Group>
          </Paper>
        </Group>

        {/* Bottom Row */}
        <Group grow align="stretch" style={{ flex: 1, minHeight: 0 }}>
          {/* Card 3: Quality & Status (pie + bar) */}
          <Paper
            withBorder
            radius="md"
            p="md"
            style={{ display: 'flex', flexDirection: 'column', flex: 1 }}
          >
            <Group gap="xs" mb="sm">
              <ThemeIcon size="sm" variant="light" color="teal">
                <IconBook2 size={16} />
              </ThemeIcon>
              <Text size="sm" fw={600}>
                Status and Quality
              </Text>
            </Group>
            <Group style={{ flex: 1, minHeight: 0 }} gap="md" grow align="stretch">
              {/* Status Pie Chart */}
              <Box style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Text size="xs" c="dimmed" ta="center" mb={4}>
                  Status
                </Text>
                <Box style={{ flex: 1, minHeight: 0 }}>
                  {statusData.length > 0 ? (
                    <PieChart
                      h="100%"
                      data={statusData}
                      withLabels
                      withTooltip
                      labelsPosition="outside"
                      labelsType="value"
                      valueFormatter={(value) => {
                        const item = statusData.find((d) => d.value === value);
                        return item?.name || String(value);
                      }}
                      tooltipProps={{
                        content: ({ payload }) => {
                          if (!payload || !payload[0]) return null;
                          const data = payload[0].payload;
                          const pct = ((data.value / statusTotal) * 100).toFixed(1);
                          return (
                            <Paper p="xs" withBorder shadow="sm">
                              <Text size="xs">Count: {data.value}</Text>
                              <Text size="xs">Pct: {pct}%</Text>
                            </Paper>
                          );
                        },
                      }}
                      pieProps={{
                        onClick: (_, index) => {
                          const segment = statusData[index];
                          handleStatusClick(segment);
                        },
                        style: { cursor: 'pointer' },
                      }}
                    />
                  ) : (
                    <Text c="dimmed" ta="center">
                      No data
                    </Text>
                  )}
                </Box>
              </Box>
              {/* Quality Bar Chart */}
              <Box style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Text size="xs" c="dimmed" ta="center" mb={4}>
                  Quality
                </Text>
                <Box style={{ flex: 1, minHeight: 0 }}>
                  {qualityData.length > 0 ? (
                    <BarChart
                      h="100%"
                      data={qualityData}
                      dataKey="quality"
                      series={[{ name: 'count', color: 'teal.6' }]}
                      tickLine="y"
                      gridAxis="y"
                      tooltipProps={{
                        content: ({ payload, label }) => {
                          if (!payload || !payload[0]) return null;
                          return (
                            <Paper p="xs" withBorder shadow="sm">
                              <Text size="xs" fw={500}>
                                {label}
                              </Text>
                              <Text size="xs">Count: {payload[0].value}</Text>
                            </Paper>
                          );
                        },
                      }}
                      barProps={{
                        onClick: (data: unknown) => {
                          const d = data as { quality?: string };
                          if (d?.quality) {
                            handleQualityClick({ quality: d.quality });
                          }
                        },
                        style: { cursor: 'pointer' },
                      }}
                    />
                  ) : (
                    <Text c="dimmed" ta="center">
                      No data
                    </Text>
                  )}
                </Box>
              </Box>
            </Group>
          </Paper>

          {/* Card 4: Works by Type (pie chart) */}
          <Paper
            withBorder
            radius="md"
            p="md"
            style={{ display: 'flex', flexDirection: 'column', flex: 1 }}
          >
            <Group gap="xs" mb="sm">
              <ThemeIcon size="sm" variant="light" color="violet">
                <IconChartPie size={16} />
              </ThemeIcon>
              <Text size="sm" fw={600}>
                Types (Works vs. Ideas)
              </Text>
            </Group>
            <Group
              style={{
                flex: 1,
                minHeight: 0,
                height: '100%',
              }}
              grow
              gap="md"
            >
              <Box style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Text size="xs" fw={500} ta="center" mb="xs">
                  Works
                </Text>
                <Box style={{ flex: 1, minHeight: 200 }}>
                  {worksTypeData.length > 0 ? (
                    <PieChart
                      h="100%"
                      data={worksTypeData}
                      withLabels
                      labelsPosition="outside"
                      labelsType="value"
                      valueFormatter={(value) => {
                        const item = worksTypeData.find((d) => d.value === value);
                        return item?.name || String(value);
                      }}
                      withTooltip
                      tooltipDataSource="segment"
                      tooltipProps={{
                        content: ({ payload }) => {
                          if (!payload || !payload[0]) return null;
                          const data = payload[0].payload;
                          const pct = ((data.value / worksTypeTotal) * 100).toFixed(1);
                          return (
                            <Paper p="xs" withBorder shadow="sm">
                              <Text size="xs">Count: {data.value}</Text>
                              <Text size="xs">Pct: {pct}%</Text>
                            </Paper>
                          );
                        },
                      }}
                      pieProps={{
                        onClick: (_, index) => {
                          const segment = worksTypeData[index];
                          handleWorksTypeClick(segment);
                        },
                        style: { cursor: 'pointer' },
                      }}
                    />
                  ) : (
                    <Text c="dimmed" ta="center">
                      No works data
                    </Text>
                  )}
                </Box>
              </Box>
              <Box style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Text size="xs" fw={500} ta="center" mb="xs">
                  Ideas
                </Text>
                <Box style={{ flex: 1, minHeight: 200 }}>
                  {ideasTypeData.length > 0 ? (
                    <PieChart
                      h="100%"
                      data={ideasTypeData}
                      withLabels
                      labelsPosition="outside"
                      labelsType="value"
                      valueFormatter={(value) => {
                        const item = ideasTypeData.find((d) => d.value === value);
                        return item?.name || String(value);
                      }}
                      withTooltip
                      tooltipDataSource="segment"
                      tooltipProps={{
                        content: ({ payload }) => {
                          if (!payload || !payload[0]) return null;
                          const data = payload[0].payload;
                          const pct = ((data.value / ideasTypeTotal) * 100).toFixed(1);
                          return (
                            <Paper p="xs" withBorder shadow="sm">
                              <Text size="xs">Count: {data.value}</Text>
                              <Text size="xs">Pct: {pct}%</Text>
                            </Paper>
                          );
                        },
                      }}
                      pieProps={{
                        onClick: (_, index) => {
                          const segment = ideasTypeData[index];
                          handleIdeasTypeClick(segment);
                        },
                        style: { cursor: 'pointer' },
                      }}
                    />
                  ) : (
                    <Text c="dimmed" ta="center">
                      No ideas data
                    </Text>
                  )}
                </Box>
              </Box>
            </Group>
          </Paper>
        </Group>
      </Box>
    </Box>
  );
}
