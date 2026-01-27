import { useState, useEffect, useCallback, useMemo } from 'react';
import { Tabs, Stack, Loader, Text, Group, ActionIcon, Flex } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconArrowBack } from '@tabler/icons-react';
import { useHotkeys } from '@mantine/hooks';
import type { DetailTab, EntityActions } from '../types';
import { useNavigation } from '../context';
import { useDeleteFlow } from '../hooks';

export interface DetailViewProps<T> {
  /**
   * The ID of the entity to display.
   */
  id: number;

  /**
   * Entity type name (e.g., 'Work', 'Collection').
   */
  entityName: string;

  /**
   * Entity type key for events (e.g., 'work', 'collection').
   */
  entityType: string;

  /**
   * Fetch the entity data by ID.
   */
  fetchEntity: (id: number) => Promise<T>;

  /**
   * Actions for delete/undelete operations.
   */
  actions: EntityActions<number>;

  /**
   * Tabs to render in the detail view.
   * Single tab = no tab UI, just renders content.
   * Multiple tabs = tabbed interface.
   */
  tabs: DetailTab<T>[];

  /**
   * Initial active tab key. Defaults to first tab.
   */
  initialTab?: string;

  /**
   * Callback when navigating to a different entity.
   */
  onNavigate?: (id: number) => void;

  /**
   * Callback when returning to list view.
   */
  onBack?: () => void;

  /**
   * Optional header content to render above tabs.
   */
  renderHeader?: (entity: T, reload: () => Promise<void>) => React.ReactNode;
}

export function DetailView<T extends { id: number; isDeleted?: boolean }>({
  id,
  entityName,
  entityType,
  fetchEntity,
  actions,
  tabs,
  initialTab,
  onNavigate,
  onBack,
  renderHeader,
}: DetailViewProps<T>) {
  const navigation = useNavigation();
  const [entity, setEntity] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(initialTab ?? tabs[0]?.key ?? '');

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEntity(id);
      setEntity(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, fetchEntity]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Update navigation when ID changes
  useEffect(() => {
    navigation.setCurrentId(id);
  }, [id, navigation]);

  const handleNext = useCallback(() => {
    if (navigation.hasNext) {
      navigation.goNext();
      const newId = navigation.currentId;
      if (newId !== null) {
        onNavigate?.(newId);
      }
    }
  }, [navigation, onNavigate]);

  const handlePrev = useCallback(() => {
    if (navigation.hasPrev) {
      navigation.goPrev();
      const newId = navigation.currentId;
      if (newId !== null) {
        onNavigate?.(newId);
      }
    }
  }, [navigation, onNavigate]);

  const handleBack = useCallback(() => {
    if (navigation.depth > 1) {
      navigation.pop();
    }
    onBack?.();
  }, [navigation, onBack]);

  // Keyboard shortcuts
  useHotkeys([
    ['ArrowRight', handleNext],
    ['ArrowLeft', handlePrev],
    ['mod+shift+ArrowLeft', handleBack],
    ['Escape', handleBack],
  ]);

  // Delete flow - exposed for use by tabs/header if needed
  const deleteFlow = useDeleteFlow<number>({
    entityName,
    actions,
    onDeleted: () => {
      void reload();
      window.dispatchEvent(new CustomEvent(`${entityType}:reload`));
    },
    onUndeleted: () => {
      void reload();
      window.dispatchEvent(new CustomEvent(`${entityType}:reload`));
    },
    onPermanentlyDeleted: () => {
      handleBack();
      window.dispatchEvent(new CustomEvent(`${entityType}:reload`));
    },
  });

  // Expose deleteFlow for external use (silence unused warning)
  void deleteFlow;

  // Single tab = no tab UI
  const showTabs = tabs.length > 1;

  const activeTabDef = useMemo(() => {
    return tabs.find((t) => t.key === activeTab) ?? tabs[0];
  }, [tabs, activeTab]);

  if (loading) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Text c="red">{error}</Text>
      </Flex>
    );
  }

  if (!entity) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Text c="dimmed">{entityName} not found</Text>
      </Flex>
    );
  }

  return (
    <Stack h="100%" gap="sm">
      {/* Navigation bar */}
      <Group justify="space-between">
        <Group gap="xs">
          {navigation.depth > 1 && (
            <ActionIcon variant="subtle" onClick={handleBack} title="Back">
              <IconArrowBack size={18} />
            </ActionIcon>
          )}
          <ActionIcon
            variant="subtle"
            onClick={handlePrev}
            disabled={!navigation.hasPrev}
            title="Previous"
          >
            <IconChevronLeft size={18} />
          </ActionIcon>
          <Text size="sm" c="dimmed">
            {navigation.currentIndex + 1} of {navigation.currentLevel?.items.length ?? 0}
          </Text>
          <ActionIcon
            variant="subtle"
            onClick={handleNext}
            disabled={!navigation.hasNext}
            title="Next"
          >
            <IconChevronRight size={18} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Optional custom header */}
      {renderHeader?.(entity, reload)}

      {/* Tab content */}
      {showTabs ? (
        <Tabs value={activeTab} onChange={(v) => setActiveTab(v ?? tabs[0]?.key ?? '')} flex={1}>
          <Tabs.List>
            {tabs.map((tab) => (
              <Tabs.Tab key={tab.key} value={tab.key} leftSection={tab.icon}>
                {tab.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {tabs.map((tab) => (
            <Tabs.Panel key={tab.key} value={tab.key} pt="sm" style={{ flex: 1 }}>
              {tab.render(entity, reload)}
            </Tabs.Panel>
          ))}
        </Tabs>
      ) : (
        // Single tab - no tab UI
        activeTabDef?.render(entity, reload)
      )}
    </Stack>
  );
}
