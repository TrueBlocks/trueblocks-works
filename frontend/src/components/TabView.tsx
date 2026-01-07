import { ReactNode, useEffect, useState, useCallback } from 'react';
import { Tabs } from '@mantine/core';
import { GetTab, SetTab } from '@wailsjs/go/main/App';

export interface Tab {
  value: string;
  label: string;
  icon?: ReactNode;
  content?: ReactNode;
}

interface TabViewProps {
  pageName: string;
  tabs: Tab[];
  defaultTab?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  children?: ReactNode;
}

export function TabView({
  pageName,
  tabs,
  defaultTab,
  activeTab: controlledTab,
  onTabChange: controlledOnChange,
  children,
}: TabViewProps) {
  const isControlled = controlledTab !== undefined;
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
        } else {
          setInternalTab(value);
          SetTab(pageName, value);
        }
      }
    },
    [isControlled, controlledOnChange, pageName]
  );

  const activeTab = isControlled ? controlledTab : internalTab;

  if (!activeTab) {
    return null;
  }

  return (
    <Tabs value={activeTab} onChange={handleTabChange}>
      <Tabs.List>
        {tabs.map((tab) => (
          <Tabs.Tab key={tab.value} value={tab.value} leftSection={tab.icon}>
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
