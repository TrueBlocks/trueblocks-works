import { ReactNode, useEffect, useState, useCallback } from 'react';
import { Tabs, Badge } from '@mantine/core';

export interface Tab {
  value: string;
  label: string;
  icon?: ReactNode;
  content?: ReactNode;
  badge?: number;
}

export interface TabViewProps {
  tabs: Tab[];
  defaultTab?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  loadTab?: () => Promise<string | null>;
  saveTab?: (tab: string) => void;
  children?: ReactNode;
}

export function TabView({
  tabs,
  defaultTab,
  activeTab: controlledTab,
  onTabChange: controlledOnChange,
  loadTab,
  saveTab,
  children,
}: TabViewProps) {
  const isControlled = controlledTab !== undefined;

  const [internalTab, setInternalTab] = useState<string | null>(() => {
    if (isControlled) return controlledTab;
    return null;
  });

  useEffect(() => {
    if (isControlled || internalTab !== null || !loadTab) return;

    loadTab().then((tab) => {
      if (tab && tabs.some((t) => t.value === tab)) {
        setInternalTab(tab);
      } else {
        setInternalTab(defaultTab || tabs[0]?.value || null);
      }
    });
  }, [tabs, defaultTab, isControlled, internalTab, loadTab]);

  // If no loadTab provided and not controlled, use default immediately
  useEffect(() => {
    if (isControlled || internalTab !== null || loadTab) return;
    setInternalTab(defaultTab || tabs[0]?.value || null);
  }, [tabs, defaultTab, isControlled, internalTab, loadTab]);

  const handleTabChange = useCallback(
    (value: string | null) => {
      if (value) {
        if (isControlled && controlledOnChange) {
          controlledOnChange(value);
        } else {
          setInternalTab(value);
          saveTab?.(value);
        }
      }
    },
    [isControlled, controlledOnChange, saveTab]
  );

  const activeTab = isControlled ? controlledTab : internalTab;

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
