import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { GetTab, SetTab } from '@app';

type TabbedPage =
  | 'works'
  | 'collections'
  | 'organizations'
  | 'submissions'
  | 'reports'
  | 'settings';

interface TabContextValue {
  getTab: (page: TabbedPage) => string;
  setTab: (page: TabbedPage, tab: string) => void;
  cycleTab: (page: TabbedPage) => void;
  setPageTabs: (page: TabbedPage, tabs: string[]) => void;
}

const defaultTabs: Record<TabbedPage, string[]> = {
  works: ['list', 'detail'],
  collections: ['list', 'detail'],
  organizations: ['list', 'detail'],
  submissions: ['list', 'detail'],
  settings: ['paths', 'field-values', 'search'],
  reports: ['recently-changed'],
};

const defaultActiveTab: Record<TabbedPage, string> = {
  works: 'list',
  collections: 'list',
  organizations: 'list',
  submissions: 'list',
  settings: 'paths',
  reports: 'recently-changed',
};

const TabContext = createContext<TabContextValue | null>(null);

export function TabProvider({ children }: { children: ReactNode }) {
  const [tabState, setTabState] = useState<Record<TabbedPage, string>>(defaultActiveTab);
  const [pageTabs, setPageTabsState] = useState<Record<TabbedPage, string[]>>(defaultTabs);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      GetTab('works'),
      GetTab('collections'),
      GetTab('organizations'),
      GetTab('submissions'),
      GetTab('settings'),
      GetTab('reports'),
    ]).then(([worksTab, collectionsTab, orgsTab, subsTab, settingsTab, reportsTab]) => {
      const newState: Record<TabbedPage, string> = { ...defaultActiveTab };
      if (worksTab) newState.works = worksTab;
      if (collectionsTab) newState.collections = collectionsTab;
      if (orgsTab) newState.organizations = orgsTab;
      if (subsTab) newState.submissions = subsTab;
      if (settingsTab) newState.settings = settingsTab;
      if (reportsTab) newState.reports = reportsTab;
      setTabState(newState);
      setLoaded(true);
    });
  }, []);

  const getTab = useCallback((page: TabbedPage) => tabState[page], [tabState]);

  const setTab = useCallback((page: TabbedPage, tab: string) => {
    setTabState((prev) => ({ ...prev, [page]: tab }));
    SetTab(page, tab);
  }, []);

  const cycleTab = useCallback(
    (page: TabbedPage) => {
      const tabs = pageTabs[page];
      const currentTab = tabState[page];
      const currentIndex = tabs.indexOf(currentTab);
      const nextIndex = (currentIndex + 1) % tabs.length;
      const nextTab = tabs[nextIndex];
      setTabState((prev) => ({ ...prev, [page]: nextTab }));
      SetTab(page, nextTab);
    },
    [pageTabs, tabState]
  );

  const setPageTabs = useCallback((page: TabbedPage, tabs: string[]) => {
    setPageTabsState((prev) => ({ ...prev, [page]: tabs }));
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <TabContext.Provider value={{ getTab, setTab, cycleTab, setPageTabs }}>
      {children}
    </TabContext.Provider>
  );
}

export function useTabContext() {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTabContext must be used within TabProvider');
  }
  return context;
}
