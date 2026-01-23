import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@mantine/core';
import { WindowGetPosition, WindowGetSize, EventsOn, EventsOff } from '@wailsjs/runtime/runtime';
import { Navigation } from '@/components/Navigation';
import { SearchModal } from '@/components/SearchModal';
import { BackupRestoreModal } from '@/components/BackupRestoreModal';
import { StatusBar } from '@/components';
import { SetupWizard } from '@/components/SetupWizard';
import { ImportReviewModal } from '@/components/ImportReviewModal';
import { ImportConfirmModal } from '@/components/ImportConfirmModal';
import { SplashScreen } from '@/components/SplashScreen';
import { DashboardPage } from '@/pages/DashboardPage';
import { WorksPage } from '@/pages/WorksPage';
import { OrganizationsPage } from '@/pages/OrganizationsPage';
import { SubmissionsPage } from '@/pages/SubmissionsPage';
import { CollectionsPage } from '@/pages/CollectionsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import {
  GetAppState,
  IsFirstRun,
  SaveWindowGeometry,
  SetLastRoute,
  ExportAllTables,
  ReimportFromCSV,
  AutoImportFilesWithEdits,
  AddTypeAndContinue,
  AddExtensionAndContinue,
  CancelImport,
  SetSidebarWidth,
} from '@app';
import { notifications } from '@mantine/notifications';
import { Log, LogErr } from '@/utils';
import type { app } from '@models';

type ImportResult = app.ImportResult;
type FileEdit = app.FileEdit;

interface EditableFileData {
  editedType?: string;
  editedYear?: string;
  editedQuality?: string;
  editedTitle?: string;
  title?: string;
  type?: string;
  year?: string;
  quality?: string;
  filename: string;
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardChecked, setWizardChecked] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [isResizing, setIsResizing] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const hasRestoredRoute = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  useKeyboardShortcuts();

  // Prevent unhandled keystrokes from causing macOS beep
  useEffect(() => {
    function handleUnhandledKey(e: KeyboardEvent) {
      // Allow browser/system shortcuts (Cmd+C, Cmd+V, Cmd+A, etc.)
      if (e.metaKey || e.ctrlKey) return;

      // Allow navigation keys when focused on inputs/textareas
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isInput) return;

      // Allow Tab for focus navigation
      if (e.key === 'Tab') return;

      // Prevent default to stop beep for unhandled printable keys
      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (e.key.length === 1 || arrowKeys.includes(e.key)) {
        e.preventDefault();
      }
    }

    window.addEventListener('keydown', handleUnhandledKey);
    return () => window.removeEventListener('keydown', handleUnhandledKey);
  }, []);

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
      if (state?.sidebarWidth && state.sidebarWidth > 0) {
        setSidebarWidth(state.sidebarWidth);
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

  // Listen for file watcher errors
  useEffect(() => {
    EventsOn('watcher:error', (message: string) => {
      notifications.show({
        title: 'File Watcher Error',
        message,
        color: 'red',
        autoClose: 5000,
      });
    });
    return () => EventsOff('watcher:error');
  }, []);

  const handleAddType = useCallback(async (newType: string) => {
    try {
      const result = await AddTypeAndContinue(newType);
      setImportResult(result);
      if (result.status === 'complete') {
        // Import finished
        setImportModalOpen(result.imported > 0 || result.updated > 0 || result.invalid.length > 0);
      }
      // If status is still 'needs_type' or 'needs_extension', modal will update
    } catch (err) {
      LogErr('Add type failed:', err);
      await CancelImport();
      setImportModalOpen(false);
    }
  }, []);

  const handleAddExtension = useCallback(async (newExtension: string) => {
    try {
      const result = await AddExtensionAndContinue(newExtension);
      setImportResult(result);
      if (result.status === 'complete') {
        // Import finished
        setImportModalOpen(result.imported > 0 || result.updated > 0 || result.invalid.length > 0);
      }
      // If status is still 'needs_type' or 'needs_extension', modal will update
    } catch (err) {
      LogErr('Add extension failed:', err);
      await CancelImport();
      setImportModalOpen(false);
    }
  }, []);

  const handleCancelImport = useCallback(async () => {
    try {
      await CancelImport();
    } catch (err) {
      LogErr('Cancel import failed:', err);
    }
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
        message: `Exported ${successCount}${failCount > 0 ? ` (${failCount} failed)` : ''}`,
        color: failCount > 0 ? 'yellow' : 'green',
        loading: false,
        autoClose: 1500,
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

  const handleImportFiles = useCallback(() => {
    setImportConfirmOpen(true);
  }, []);

  const handleImportConfirm = useCallback(
    async (collectionID: number, fileEdits?: Record<string, EditableFileData>) => {
      Log('Starting file import...');
      try {
        // Convert edits to FileEdit array
        const edits: FileEdit[] = [];
        if (fileEdits) {
          for (const [filename, edit] of Object.entries(fileEdits)) {
            edits.push({
              filename,
              title: edit.editedTitle ?? edit.title ?? '',
              type: edit.editedType ?? edit.type ?? '',
              year: edit.editedYear ?? edit.year ?? '',
              quality: edit.editedQuality ?? edit.quality ?? '',
            });
          }
        }
        const result = await AutoImportFilesWithEdits(collectionID, edits);
        if (
          result.status === 'needs_type' ||
          result.imported > 0 ||
          result.updated > 0 ||
          (result.invalid?.length ?? 0) > 0
        ) {
          setImportResult(result);
          setImportModalOpen(true);
        } else {
          notifications.show({
            message: 'No files found to import',
            color: 'blue',
            autoClose: 2000,
          });
        }
      } catch (err) {
        LogErr('File import failed:', err);
        notifications.show({
          message: 'Import failed: ' + String(err),
          color: 'red',
          autoClose: 5000,
        });
      }
    },
    []
  );

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
        message: 'Reimported',
        color: 'green',
        loading: false,
        autoClose: 1500,
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
      if (e.metaKey && e.shiftKey && e.key === 'i') {
        e.preventDefault();
        handleReimportAll();
      }
      if (e.metaKey && !e.shiftKey && e.key === 'i') {
        e.preventDefault();
        handleImportFiles();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExportAll, handleReimportAll, handleImportFiles]);

  // Sidebar resize handlers
  const ICON_ONLY_WIDTH = 56;
  const MIN_WITH_TEXT = 120;
  const MAX_WIDTH = 300;

  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rawWidth = e.clientX;
      // Snap to icon-only if dragged below threshold
      let newWidth: number;
      if (rawWidth < 80) {
        newWidth = ICON_ONLY_WIDTH;
      } else {
        newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WITH_TEXT, rawWidth));
      }
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      SetSidebarWidth(sidebarWidth);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, sidebarWidth]);

  const isCollapsed = sidebarWidth <= ICON_ONLY_WIDTH;

  if (!wizardChecked) {
    return null;
  }

  if (showSplash) {
    return <SplashScreen duration={2000} onComplete={() => setShowSplash(false)} />;
  }

  return (
    <>
      <SetupWizard opened={showWizard} onComplete={() => setShowWizard(false)} />
      <SearchModal opened={searchOpen} onClose={() => setSearchOpen(false)} />
      <BackupRestoreModal opened={backupOpen} onClose={() => setBackupOpen(false)} />
      <ImportConfirmModal
        opened={importConfirmOpen}
        onClose={() => setImportConfirmOpen(false)}
        onConfirm={handleImportConfirm}
      />
      <ImportReviewModal
        opened={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        result={importResult}
        onNavigateToCollection={(id) => navigate(`/collections/${id}`)}
        onAddType={handleAddType}
        onAddExtension={handleAddExtension}
        onCancelImport={handleCancelImport}
      />
      <AppShell
        header={{ height: 50 }}
        navbar={{ width: sidebarWidth, breakpoint: 'sm' }}
        padding="md"
      >
        <AppShell.Header>
          <Navigation />
        </AppShell.Header>
        <AppShell.Navbar p={isCollapsed ? 'xs' : 'md'}>
          <Navigation.Links collapsed={isCollapsed} />
        </AppShell.Navbar>
        <div
          onMouseDown={handleSidebarMouseDown}
          style={{
            position: 'fixed',
            top: 50,
            left: sidebarWidth - 2,
            width: 4,
            height: 'calc(100vh - 50px)',
            cursor: 'col-resize',
            backgroundColor: isResizing ? 'var(--mantine-color-blue-4)' : 'transparent',
            zIndex: 1000,
          }}
          onMouseEnter={(e) => {
            if (!isResizing) e.currentTarget.style.backgroundColor = 'var(--mantine-color-gray-5)';
          }}
          onMouseLeave={(e) => {
            if (!isResizing) e.currentTarget.style.backgroundColor = 'transparent';
          }}
        />
        <AppShell.Main>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/works" element={<WorksPage />} />
            <Route path="/works/:id" element={<WorksPage />} />
            <Route path="/organizations" element={<OrganizationsPage />} />
            <Route path="/organizations/:id" element={<OrganizationsPage />} />
            <Route path="/submissions" element={<SubmissionsPage />} />
            <Route path="/submissions/:id" element={<SubmissionsPage />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/collections/:id" element={<CollectionsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
          <StatusBar sidebarWidth={sidebarWidth} />
        </AppShell.Main>
      </AppShell>
    </>
  );
}

export default App;
