import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTabContext } from '@/stores';
import { GetAppState, OpenDocument } from '@wailsjs/go/main/App';
import { LogErr } from '@/utils';

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

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cycleTab } = useTabContext();

  useEffect(() => {
    async function handleKeyDown(e: KeyboardEvent) {
      if (!e.metaKey) return;

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

        if (currentPath === targetPath && tabbedPages[targetPath]) {
          cycleTab(tabbedPages[targetPath]);
        } else {
          navigate(targetPath);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, location.pathname, cycleTab]);
}
