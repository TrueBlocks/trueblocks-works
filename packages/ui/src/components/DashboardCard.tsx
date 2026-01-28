import { useState } from 'react';
import {
  Card,
  Group,
  Title,
  Text,
  ActionIcon,
  Button,
  Box,
  Divider,
  ScrollArea,
} from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconPlus, IconArrowRight } from '@tabler/icons-react';

export interface DashboardCardPage {
  title: string;
  content: React.ReactNode;
}

export interface DashboardCardProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  pages: DashboardCardPage[];
  onViewAll: () => void;
  onNew?: () => void;
  sparkline?: number[];
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

export function DashboardCard({
  title,
  icon,
  color,
  pages,
  onViewAll,
  onNew,
  sparkline,
  currentPage = 0,
  onPageChange,
}: DashboardCardProps) {
  const [internalPage, setInternalPage] = useState(currentPage);
  const activePage = onPageChange ? currentPage : internalPage;
  const setActivePage = onPageChange || setInternalPage;

  const handlePrev = () => {
    setActivePage(activePage > 0 ? activePage - 1 : pages.length - 1);
  };

  const handleNext = () => {
    setActivePage(activePage < pages.length - 1 ? activePage + 1 : 0);
  };

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder h="100%">
      <Card.Section
        withBorder
        inheritPadding
        py="sm"
        style={{ backgroundColor: `var(--mantine-color-${color}-0)` }}
      >
        <Group justify="space-between" align="center">
          <Group gap="xs" align="center">
            <Box c={color}>{icon}</Box>
            <Title order={4} c={color} style={{ cursor: 'pointer' }} onClick={onViewAll}>
              {title}
            </Title>
          </Group>
          {pages.length > 1 && (
            <Group gap={4} align="center">
              <ActionIcon variant="subtle" size="sm" onClick={handlePrev}>
                <IconChevronLeft size={16} />
              </ActionIcon>
              <ActionIcon variant="subtle" size="sm" onClick={handleNext}>
                <IconChevronRight size={16} />
              </ActionIcon>
            </Group>
          )}
        </Group>
      </Card.Section>

      <Box mt="md">
        <Text size="sm" fw={500} c="dimmed" mb="xs">
          {pages[activePage]?.title}
        </Text>
        <ScrollArea h={140} offsetScrollbars scrollbarSize={6}>
          {pages[activePage]?.content}
        </ScrollArea>
      </Box>

      {sparkline && sparkline.length > 0 && (
        <>
          <Divider my="sm" />
          <Sparkline data={sparkline} color={color} />
        </>
      )}

      <Divider my="sm" />

      <Group justify="space-between">
        <Group gap="xs">
          {pages.length > 1 &&
            pages.map((_, idx) => (
              <Box
                key={idx}
                w={8}
                h={8}
                style={{
                  borderRadius: '50%',
                  backgroundColor:
                    idx === activePage
                      ? `var(--mantine-color-${color}-6)`
                      : `var(--mantine-color-gray-3)`,
                  cursor: 'pointer',
                }}
                onClick={() => setActivePage(idx)}
              />
            ))}
        </Group>
        <Group gap="xs">
          <Button
            variant="light"
            color={color}
            size="xs"
            rightSection={<IconArrowRight size={14} />}
            onClick={onViewAll}
          >
            View All
          </Button>
          {onNew && (
            <Button
              variant="filled"
              color={color}
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={onNew}
            >
              New
            </Button>
          )}
        </Group>
      </Group>
    </Card>
  );
}

interface SparklineProps {
  data: number[];
  color: string;
}

function Sparkline({ data, color }: SparklineProps) {
  const max = Math.max(...data, 1);
  const height = 30;
  const width = 100;

  return (
    <Box style={{ width: '100%', height }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }}>
        <polyline
          fill="none"
          stroke={`var(--mantine-color-${color}-4)`}
          strokeWidth="1.5"
          points={data
            .map(
              (v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * (height - 4)}`
            )
            .join(' ')}
        />
        {data.map((v, i) => (
          <circle
            key={i}
            cx={(i / (data.length - 1)) * width}
            cy={height - (v / max) * (height - 4)}
            r={v > 0 ? 1.5 : 0}
            fill={`var(--mantine-color-${color}-6)`}
          />
        ))}
      </svg>
    </Box>
  );
}

export interface StatRowProps {
  label: string;
  value: number | string;
  onClick?: () => void;
  color?: string;
}

export function StatRow({ label, value, onClick, color }: StatRowProps) {
  return (
    <Group
      justify="space-between"
      style={{
        cursor: onClick ? 'pointer' : 'default',
        padding: '4px 8px',
        borderRadius: 4,
        transition: 'background-color 0.15s',
      }}
      {...(onClick ? { className: 'stat-row-hover', onClick } : {})}
    >
      <Text size="sm">{label}</Text>
      <Text size="sm" fw={600} {...(color ? { c: color } : {})}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Text>
    </Group>
  );
}
