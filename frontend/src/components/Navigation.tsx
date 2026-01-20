import { Group, Title, Text, Divider, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  IconBook2,
  IconBuilding,
  IconSend,
  IconFolder,
  IconSettings,
  IconReportAnalytics,
  IconDashboard,
} from '@tabler/icons-react';
import { GetTab, GetAppState } from '@app';
import { DarkModeToggle } from './DarkModeToggle';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: IconDashboard, hasTabs: false },
  { path: '/collections', label: 'Collections', icon: IconFolder, hasTabs: true },
  { path: '/works', label: 'Works', icon: IconBook2, hasTabs: true },
  { path: '/organizations', label: 'Organizations', icon: IconBuilding, hasTabs: true },
  { path: '/submissions', label: 'Submissions', icon: IconSend, hasTabs: true },
];

export function Navigation() {
  return (
    <Group h="100%" px="md" justify="space-between">
      <Title order={3}>Works</Title>
      <Group gap="md">
        <Text size="sm" c="dimmed" fs="italic">
          A Studio Ledger
        </Text>
        <DarkModeToggle />
      </Group>
    </Group>
  );
}

interface LinksProps {
  collapsed?: boolean;
}

function Links({ collapsed = false }: LinksProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleNavClick = async (
    e: React.MouseEvent,
    item: { path: string; label: string; icon: typeof IconBook2; hasTabs: boolean }
  ) => {
    const currentPath = location.pathname;
    const basePath = '/' + currentPath.split('/')[1];

    // Check if clicking the same base route
    if (basePath === item.path && item.hasTabs) {
      e.preventDefault();

      // Get current tab
      const pageName = item.path.substring(1); // Remove leading slash
      const currentTab = await GetTab(pageName);

      // Determine target tab
      if (currentTab === 'detail' || !currentTab) {
        // Go to list
        navigate(item.path);
      } else {
        // Go to detail - need to get last entity ID
        const state = await GetAppState();
        let lastId: number | undefined;

        switch (pageName) {
          case 'works':
            lastId = state.lastWorkID;
            break;
          case 'collections':
            lastId = state.lastCollectionID;
            break;
          case 'organizations':
            lastId = state.lastOrgID;
            break;
          case 'submissions':
            lastId = state.lastSubmissionID;
            break;
        }

        if (lastId && lastId > 0) {
          navigate(`${item.path}/${lastId}`);
        } else {
          // This should NEVER happen - show error toast
          notifications.show({
            title: 'Tab Cycling Failed',
            message: `Cannot switch to Detail tab: no ${pageName} ID available. Page: ${pageName}, CurrentTab: ${currentTab || 'null'}, LastID: ${lastId || 'undefined'}, Location: ${location.pathname}`,
            color: 'red',
            autoClose: 10000,
          });
        }
      }
    }
  };

  const renderLink = (item: {
    path: string;
    label: string;
    icon: typeof IconBook2;
    hasTabs: boolean;
  }) => {
    const isActive =
      location.pathname === item.path ||
      location.pathname.startsWith(item.path + '/') ||
      (location.pathname === '/' && item.path === '/dashboard');
    return (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={(e) => handleNavClick(e, item)}
        title={collapsed ? item.label : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: collapsed ? 0 : '8px',
          padding: collapsed ? '10px' : '10px 12px',
          borderRadius: '6px',
          textDecoration: 'none',
          color: isActive ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-text)',
          backgroundColor: isActive ? 'var(--mantine-color-blue-light)' : 'transparent',
          fontWeight: isActive ? 600 : 400,
          marginBottom: '4px',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        <item.icon size={20} stroke={1.5} style={{ flexShrink: 0 }} />
        {!collapsed && (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
        )}
      </NavLink>
    );
  };

  return (
    <Stack justify="space-between" h="100%">
      <div>{navItems.map(renderLink)}</div>
      <div>
        <Divider my="sm" />
        {renderLink({
          path: '/reports',
          label: 'Reports',
          icon: IconReportAnalytics,
          hasTabs: true,
        })}
        {renderLink({
          path: '/settings',
          label: 'Settings',
          icon: IconSettings,
          hasTabs: true,
        })}
      </div>
    </Stack>
  );
}

Navigation.Links = Links;
