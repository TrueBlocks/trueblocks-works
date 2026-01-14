import { ReactNode, useEffect, useState, useCallback } from 'react';
import { Tabs, Badge } from '@mantine/core';
import { GetTab, SetTab } from '@app';
import { useTabContext } from '@/stores';

export interface Tab {
  value: string;
  label: string;
  icon?: ReactNode;
  content?: ReactNode;
  badge?: number;
}

interface TabViewProps {
  pageName: string;
  tabs: Tab[];
  defaultTab?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  children?: ReactNode;
}

const CONTEXT_PAGES = new Set(['settings', 'reports']);

export function TabView({
  pageName,
  tabs,
  defaultTab,
  activeTab: controlledTab,
  onTabChange: controlledOnChange,
  children,
}: TabViewProps) {
  const isControlled = controlledTab !== undefined;
  const usesContext = CONTEXT_PAGES.has(pageName);
  const tabContext = useTabContext();

  const [internalTab, setInternalTab] = useState<string | null>(() => {
    if (isControlled) return controlledTab;
    return null;
  });

  useEffect(() => {
    if (isControlled || internalTab !== null) return;

    GetTab(pageName).then((tab) => {
      if (tab && tabs.some((t) => t.value === tab)) {
        setInternalTab(tab);
      } else {
        setInternalTab(defaultTab || tabs[0]?.value || null);
      }
    });
  }, [pageName, tabs, defaultTab, isControlled, internalTab]);

  const handleTabChange = useCallback(
    (value: string | null) => {
      if (value) {
        if (isControlled && controlledOnChange) {
          controlledOnChange(value);
        } else if (usesContext) {
          tabContext.setTab(pageName as 'settings' | 'reports', value);
        } else {
          setInternalTab(value);
          SetTab(pageName, value);
        }
      }
    },
    [isControlled, controlledOnChange, pageName, usesContext, tabContext]
  );

  let activeTab: string | null;
  if (isControlled) {
    activeTab = controlledTab;
  } else if (usesContext) {
    activeTab = tabContext.getTab(pageName as 'settings' | 'reports');
  } else {
    activeTab = internalTab;
  }

  if (!activeTab) {
    return null;
  }

  return (
    <Tabs value={activeTab} onChange={handleTabChange}>
      <Tabs.List>
        {tabs.map((tab) => (
          <Tabs.Tab
            key={tab.value}
            value={tab.value}
            leftSection={tab.icon}
            rightSection={
              tab.badge !== undefined && tab.badge > 0 ? (
                <Badge size="xs" circle color="red" variant="filled">
                  {tab.badge}
                </Badge>
              ) : null
            }
          >
            {tab.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>

      {children ||
        tabs.map((tab) => (
          <Tabs.Panel key={tab.value} value={tab.value} pt="md">
            {tab.content}
          </Tabs.Panel>
        ))}
    </Tabs>
  );
}
