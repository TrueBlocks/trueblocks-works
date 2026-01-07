import { Group, Title, Text, Divider, Stack } from '@mantine/core';
import { NavLink, useLocation } from 'react-router-dom';
import {
  IconBook2,
  IconBuilding,
  IconSend,
  IconFolder,
  IconSettings,
  IconReportAnalytics,
  IconDashboard,
} from '@tabler/icons-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { path: '/collections', label: 'Collections', icon: IconFolder },
  { path: '/works', label: 'Works', icon: IconBook2 },
  { path: '/organizations', label: 'Organizations', icon: IconBuilding },
  { path: '/submissions', label: 'Submissions', icon: IconSend },
];

export function Navigation() {
  return (
    <Group h="100%" px="md" justify="space-between">
      <Title order={3}>Works</Title>
      <Text size="sm" c="dimmed">
        Creative Writing Tracker
      </Text>
    </Group>
  );
}

function Links() {
  const location = useLocation();

  const renderLink = (item: { path: string; label: string; icon: typeof IconBook2 }) => {
    const isActive =
      location.pathname === item.path || (location.pathname === '/' && item.path === '/dashboard');
    return (
      <NavLink
        key={item.path}
        to={item.path}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 12px',
          borderRadius: '6px',
          textDecoration: 'none',
          color: isActive ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-dark-6)',
          backgroundColor: isActive ? 'var(--mantine-color-blue-0)' : 'transparent',
          fontWeight: isActive ? 600 : 400,
          marginBottom: '4px',
        }}
      >
        <item.icon size={20} stroke={1.5} />
        {item.label}
      </NavLink>
    );
  };

  return (
    <Stack justify="space-between" h="100%">
      <div>{navItems.map(renderLink)}</div>
      <div>
        <Divider my="sm" />
        {renderLink({ path: '/reports', label: 'Reports', icon: IconReportAnalytics })}
        {renderLink({ path: '/settings', label: 'Settings', icon: IconSettings })}
      </div>
    </Stack>
  );
}

Navigation.Links = Links;
