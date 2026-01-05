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
import { CollectionDetailPage } from '@/pages/CollectionDetailPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ExportPage } from '@/pages/ExportPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import {
  GetAppState,
  IsFirstRun,
  SaveWindowGeometry,
  SetLastRoute,
  ExportAllTables,
  ReimportFromCSV,
} from '@wailsjs/go/main/App';
import { notifications } from '@mantine/notifications';
import { Log, LogErr } from '@/utils';

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

  const handleExportAll = useCallback(async () => {
    Log('Starting export of all tables...');
    notifications.show({
      id: 'export-progress',
      title: 'Exporting',
      message: 'Exporting all tables...',
      loading: true,
      autoClose: false,
    });
    try {
      const results = await ExportAllTables();
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;
      Log(`Export complete: ${successCount} succeeded, ${failCount} failed`);
      notifications.update({
        id: 'export-progress',
        title: 'Export Complete',
        message: `Exported ${successCount} tables${failCount > 0 ? `, ${failCount} failed` : ''}`,
        color: failCount > 0 ? 'yellow' : 'green',
        loading: false,
        autoClose: 3000,
      });
    } catch (err) {
      LogErr('Export failed:', err);
      notifications.update({
        id: 'export-progress',
        title: 'Export Failed',
        message: String(err),
        color: 'red',
        loading: false,
        autoClose: 5000,
      });
    }
  }, []);

  const handleReimportAll = useCallback(async () => {
    Log('Starting reimport from CSV...');
    notifications.show({
      id: 'reimport-progress',
      title: 'Reimporting',
      message: 'Reimporting data from CSV files...',
      loading: true,
      autoClose: false,
    });
    try {
      await ReimportFromCSV();
      Log('Reimport complete');
      notifications.update({
        id: 'reimport-progress',
        title: 'Reimport Complete',
        message: 'Data reimported successfully. Refresh the page to see changes.',
        color: 'green',
        loading: false,
        autoClose: 3000,
      });
    } catch (err) {
      LogErr('Reimport failed:', err);
      notifications.update({
        id: 'reimport-progress',
        title: 'Reimport Failed',
        message: String(err),
        color: 'red',
        loading: false,
        autoClose: 5000,
      });
    }
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
      if (e.metaKey && e.key === 'x') {
        e.preventDefault();
        handleExportAll();
      }
      if (e.metaKey && e.key === 'i') {
        e.preventDefault();
        handleReimportAll();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExportAll, handleReimportAll]);

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
            <Route path="/collections/:id" element={<CollectionDetailPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/export" element={<ExportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </AppShell.Main>
      </AppShell>
    </>
  );
}

export default App;
