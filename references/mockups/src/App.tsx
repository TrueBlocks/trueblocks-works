import { Routes, Route } from 'react-router-dom';
import { AppShell, NavLink, Group, Title, Text, Kbd } from '@mantine/core';
import {
  IconHome,
  IconFileText,
  IconSend,
  IconBuilding,
  IconFolder,
} from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';

import CollectionsPage from './pages/CollectionsPage';
import WorksPage from './pages/WorksPage';
import WorkDetailPage from './pages/WorkDetailPage';
import SubmissionsPage from './pages/SubmissionsPage';
import OrganizationsPage from './pages/OrganizationsPage';
import { useGlobalKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { KeyboardHints } from './components';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Enable global keyboard shortcuts (⌘1-4 for page navigation)
  useGlobalKeyboardShortcuts();

  const navItems = [
    { icon: IconHome, label: 'Collections', path: '/', shortcut: '⌘1' },
    { icon: IconFileText, label: 'Works', path: '/works', shortcut: '⌘2' },
    { icon: IconSend, label: 'Submissions', path: '/submissions', shortcut: '⌘3' },
    { icon: IconBuilding, label: 'Organizations', path: '/organizations', shortcut: '⌘4' },
  ];

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 220, breakpoint: 'sm' }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <IconFolder size={28} color="#228be6" />
          <Title order={3}>Submissions Tracker</Title>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <Text size="xs" c="dimmed" fw={500} mb="xs" tt="uppercase">
          Navigation
        </Text>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            label={
              <Group justify="space-between" w="100%">
                <span>{item.label}</span>
                <Kbd size="xs" style={{ opacity: 0.6 }}>{item.shortcut}</Kbd>
              </Group>
            }
            leftSection={<item.icon size={18} />}
            active={location.pathname === item.path}
            onClick={() => navigate(item.path)}
            mb={4}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main style={{ paddingBottom: 50 }}>
        <Routes>
          <Route path="/" element={<CollectionsPage />} />
          <Route path="/works" element={<WorksPage />} />
          <Route path="/works/:id" element={<WorkDetailPage />} />
          <Route path="/submissions" element={<SubmissionsPage />} />
          <Route path="/organizations" element={<OrganizationsPage />} />
        </Routes>
        <KeyboardHints />
      </AppShell.Main>
    </AppShell>
  );
}

export default App;
