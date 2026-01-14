import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTabContext } from '@/stores';
import { useDebug } from '@/stores';
import { GetAppState, OpenDocument, ToggleShowDeleted } from '@app';
import { LogErr } from '@/utils';
import { notifications } from '@mantine/notifications';

const shortcuts: Record<string, string> = {
  '1': '/dashboard',
  '2': '/collections',
  '3': '/works',
  '4': '/organizations',
  '5': '/submissions',
  '6': '/reports',
  '7': '/settings',
};

const tabbedPages: Record<
  string,
  'works' | 'collections' | 'organizations' | 'submissions' | 'settings' | 'reports'
> = {
  '/works': 'works',
  '/collections': 'collections',
  '/organizations': 'organizations',
  '/submissions': 'submissions',
  '/settings': 'settings',
  '/reports': 'reports',
};

const entityPages: Record<string, { idField: keyof Awaited<ReturnType<typeof GetAppState>> }> = {
  '/works': { idField: 'lastWorkID' },
  '/collections': { idField: 'lastCollectionID' },
  '/organizations': { idField: 'lastOrgID' },
  '/submissions': { idField: 'lastSubmissionID' },
};

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cycleTab, getTab } = useTabContext();
  const { toggleDebugMode } = useDebug();

  useEffect(() => {
    async function handleKeyDown(e: KeyboardEvent) {
      if (!e.metaKey) return;

      // Cmd+Shift+D: Toggle show deleted items
      if (e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        try {
          const newValue = await ToggleShowDeleted();
          window.dispatchEvent(new CustomEvent('showDeletedChanged', { detail: newValue }));
          notifications.show({
            title: 'Show Deleted Toggled',
            message: newValue ? 'Deleted items are now visible' : 'Deleted items are now hidden',
            color: newValue ? 'blue' : 'gray',
            autoClose: 2000,
          });
        } catch (err) {
          LogErr('Failed to toggle show deleted:', err);
        }
        return;
      }

      // Cmd+D: Toggle debug mode
      if (!e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        toggleDebugMode();
        return;
      }

      // Cmd+R: Reload current view
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('reloadCurrentView'));
        return;
      }

      // Cmd+O: Open current work's document
      if (e.key === 'o') {
        e.preventDefault();
        const notificationId = 'open-document';
        try {
          const appState = await GetAppState();
          if (appState?.lastWorkID) {
            notifications.show({
              id: notificationId,
              title: 'Opening Document',
              message: 'Launching application...',
              loading: true,
              autoClose: false,
              withCloseButton: false,
            });
            await OpenDocument(appState.lastWorkID);
            notifications.update({
              id: notificationId,
              title: 'Document Opened',
              message: 'The document has been sent to the default application',
              loading: false,
              autoClose: 2000,
              withCloseButton: true,
            });
          } else {
            notifications.show({
              title: 'No Work Selected',
              message: 'Select a work first to open its document',
              color: 'yellow',
              autoClose: 3000,
            });
          }
        } catch (err) {
          LogErr('Failed to open document:', err);
          notifications.update({
            id: notificationId,
            title: 'Failed to Open Document',
            message: String(err),
            color: 'red',
            loading: false,
            autoClose: 5000,
            withCloseButton: true,
          });
        }
        return;
      }

      // Cmd+1-7: Navigation shortcuts
      if (shortcuts[e.key]) {
        e.preventDefault();
        const targetPath = shortcuts[e.key];
        const currentPath = location.pathname;
        const basePath = '/' + currentPath.split('/')[1];

        // If on the same page, cycle tabs
        if (basePath === targetPath && tabbedPages[targetPath]) {
          const pageName = tabbedPages[targetPath];
          cycleTab(pageName);

          // For entity pages, cycling requires navigation
          if (entityPages[targetPath]) {
            const { idField } = entityPages[targetPath];
            const state = await GetAppState();
            const lastId = state[idField] as number | undefined;

            // After cycling, check the new tab state - if it's detail, navigate to detail
            // We just cycled, so if we were on list, we're now on detail
            const isOnDetail = currentPath !== targetPath;

            if (isOnDetail) {
              // Was on detail, cycled to list
              navigate(targetPath);
            } else {
              // Was on list, cycled to detail
              if (lastId && lastId > 0) {
                navigate(`${targetPath}/${lastId}`);
              } else {
                navigate(targetPath);
              }
            }
          }
          return;
        }

        // Different page - check if we should go to detail or list based on stored tab
        if (entityPages[targetPath]) {
          const pageName = tabbedPages[targetPath];
          const storedTab = getTab(pageName);

          if (storedTab === 'detail') {
            const { idField } = entityPages[targetPath];
            const state = await GetAppState();
            const lastId = state[idField] as number | undefined;
            if (lastId && lastId > 0) {
              navigate(`${targetPath}/${lastId}`);
              return;
            }
          }
        }
        navigate(targetPath);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, location.pathname, cycleTab, getTab, toggleDebugMode]);
}
