import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@mantine/core';
import { WindowGetPosition, WindowGetSize } from '@wailsjs/runtime/runtime';
import { Navigation } from '@/components/Navigation';
import { SearchModal } from '@/components/SearchModal';
import { BackupRestoreModal } from '@/components/BackupRestoreModal';
import { SetupWizard } from '@/components/SetupWizard';
import { WorksPage } from '@/pages/WorksPage';
import { WorkDetailPage } from '@/pages/WorkDetailPage';
import { OrganizationsPage } from '@/pages/OrganizationsPage';
import { OrganizationDetailPage } from '@/pages/OrganizationDetailPage';
import { SubmissionsPage } from '@/pages/SubmissionsPage';
import { SubmissionDetailPage } from '@/pages/SubmissionDetailPage';
import { CollectionsPage } from '@/pages/CollectionsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ExportPage } from '@/pages/ExportPage';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { GetAppState, IsFirstRun, SaveWindowGeometry, SetLastRoute } from '@wailsjs/go/main/App';

function App() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardChecked, setWizardChecked] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const hasRestoredRoute = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  useKeyboardShortcuts();

  // Save route on navigation
  useEffect(() => {
    if (hasRestoredRoute.current) {
      SetLastRoute(location.pathname);
    }
  }, [location.pathname]);

  // Restore last route on startup (runs once)
  useEffect(() => {
    if (hasRestoredRoute.current) return;
    hasRestoredRoute.current = true;

    GetAppState().then((state) => {
      if (state?.lastRoute && state.lastRoute !== '/' && state.lastRoute !== location.pathname) {
        navigate(state.lastRoute, { replace: true });
      }
    });
  }, [location.pathname, navigate]);

  // Save window geometry on resize/move (debounced)
  const saveWindowGeometry = useCallback(async () => {
    try {
      const { x, y } = await WindowGetPosition();
      const { w, h } = await WindowGetSize();
      await SaveWindowGeometry(x, y, w, h);
    } catch {
      // Ignore errors during dev mode
    }
  }, []);

  useEffect(() => {
    function handleResize() {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = window.setTimeout(saveWindowGeometry, 500);
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [saveWindowGeometry]);

  useEffect(() => {
    async function checkFirstRun() {
      const isFirst = await IsFirstRun();
      setShowWizard(isFirst);
      setWizardChecked(true);
    }
    checkFirstRun();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.metaKey && e.shiftKey && e.key === 'b') {
        e.preventDefault();
        setBackupOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!wizardChecked) {
    return null;
  }

  return (
    <>
      <SetupWizard opened={showWizard} onComplete={() => setShowWizard(false)} />
      <SearchModal opened={searchOpen} onClose={() => setSearchOpen(false)} />
      <BackupRestoreModal opened={backupOpen} onClose={() => setBackupOpen(false)} />
      <AppShell header={{ height: 60 }} navbar={{ width: 220, breakpoint: 'sm' }} padding="md">
        <AppShell.Header>
          <Navigation />
        </AppShell.Header>
        <AppShell.Navbar p="md">
          <Navigation.Links />
        </AppShell.Navbar>
        <AppShell.Main>
          <Routes>
            <Route path="/" element={<WorksPage />} />
            <Route path="/works" element={<WorksPage />} />
            <Route path="/works/:id" element={<WorkDetailPage />} />
            <Route path="/organizations" element={<OrganizationsPage />} />
            <Route path="/organizations/:id" element={<OrganizationDetailPage />} />
            <Route path="/submissions" element={<SubmissionsPage />} />
            <Route path="/submissions/:id" element={<SubmissionDetailPage />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/export" element={<ExportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </AppShell.Main>
      </AppShell>
    </>
  );
}

export default App;
