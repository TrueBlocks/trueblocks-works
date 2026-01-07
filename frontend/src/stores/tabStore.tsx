import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type TabbedPage = 'settings' | 'reports';

interface TabContextValue {
  getTab: (page: TabbedPage) => string;
  setTab: (page: TabbedPage, tab: string) => void;
  cycleTab: (page: TabbedPage) => void;
  setPageTabs: (page: TabbedPage, tabs: string[]) => void;
}

const defaultTabs: Record<TabbedPage, string[]> = {
  settings: ['paths', 'field-values'],
  reports: ['recently-changed'],
};

const defaultActiveTab: Record<TabbedPage, string> = {
  settings: 'paths',
  reports: 'recently-changed',
};

const TabContext = createContext<TabContextValue | null>(null);

export function TabProvider({ children }: { children: ReactNode }) {
  const [tabState, setTabState] = useState<Record<TabbedPage, string>>(defaultActiveTab);
  const [pageTabs, setPageTabsState] = useState<Record<TabbedPage, string[]>>(defaultTabs);

  const getTab = useCallback((page: TabbedPage) => tabState[page], [tabState]);

  const setTab = useCallback((page: TabbedPage, tab: string) => {
    setTabState((prev) => ({ ...prev, [page]: tab }));
  }, []);

  const cycleTab = useCallback(
    (page: TabbedPage) => {
      const tabs = pageTabs[page];
      const currentTab = tabState[page];
      const currentIndex = tabs.indexOf(currentTab);
      const nextIndex = (currentIndex + 1) % tabs.length;
      setTabState((prev) => ({ ...prev, [page]: tabs[nextIndex] }));
    },
    [pageTabs, tabState]
  );

  const setPageTabs = useCallback((page: TabbedPage, tabs: string[]) => {
    setPageTabsState((prev) => ({ ...prev, [page]: tabs }));
  }, []);

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
