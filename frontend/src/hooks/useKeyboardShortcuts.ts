import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTabContext } from '@/stores';
import { GetAppState, OpenDocument, GetTab, ToggleShowDeleted } from '@wailsjs/go/main/App';
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

const tabbedPages: Record<string, 'settings' | 'reports'> = {
  '/settings': 'settings',
  '/reports': 'reports',
};

const entityPages: Record<
  string,
  { pageName: 'works' | 'collections' | 'organizations' | 'submissions'; idField: string }
> = {
  '/works': { pageName: 'works', idField: 'lastWorkID' },
  '/collections': { pageName: 'collections', idField: 'lastCollectionID' },
  '/organizations': { pageName: 'organizations', idField: 'lastOrgID' },
  '/submissions': { pageName: 'submissions', idField: 'lastSubmissionID' },
};

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cycleTab } = useTabContext();

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

      // Cmd+O: Open current work's document
      if (e.key === 'o') {
        e.preventDefault();
        try {
          const appState = await GetAppState();
          if (appState?.lastWorkID) {
            await OpenDocument(appState.lastWorkID);
          }
        } catch (err) {
          LogErr('Failed to open document:', err);
        }
        return;
      }

      // Cmd+1-7: Navigation shortcuts
      if (shortcuts[e.key]) {
        e.preventDefault();
        const targetPath = shortcuts[e.key];
        const currentPath = location.pathname;
        const basePath = '/' + currentPath.split('/')[1];

        // Simple tabbed pages (Settings, Reports) - cycle through their tabs
        if (currentPath === targetPath && tabbedPages[targetPath]) {
          cycleTab(tabbedPages[targetPath]);
          return;
        }

        // Entity pages (Works, Collections, etc.) - cycle between list/detail
        if (basePath === targetPath && entityPages[targetPath]) {
          const { pageName, idField } = entityPages[targetPath];
          const currentTab = await GetTab(pageName);

          if (currentTab === 'detail' || !currentTab) {
            // Go to list
            navigate(targetPath);
          } else {
            // Go to detail - get last entity ID
            const state = await GetAppState();
            const lastId = (state as unknown as Record<string, number | undefined>)[idField];

            if (lastId && lastId > 0) {
              navigate(`${targetPath}/${lastId}`);
            } else {
              // Should never happen - show error toast
              notifications.show({
                title: 'Tab Cycling Failed',
                message: `Cannot switch to Detail tab: no ${pageName} ID available. Page: ${pageName}, CurrentTab: ${currentTab || 'null'}, LastID: ${lastId || 'undefined'}, Location: ${location.pathname}`,
                color: 'red',
                autoClose: 10000,
              });
            }
          }
          return;
        }

        // Different page - just navigate
        navigate(targetPath);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, location.pathname, cycleTab]);
}
