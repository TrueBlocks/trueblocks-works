import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useMemo,
  useRef,
} from 'react';

export interface NavigationLevel<T = unknown> {
  entityType: string;
  items: T[];
  currentId: number;
  parentId?: number;
}

export interface NavigationContextValue {
  stack: NavigationLevel[];
  currentLevel: NavigationLevel | null;
  depth: number;
  currentId: number | null;

  setItems: <T>(entityType: string, items: T[], currentId: number) => void;
  setCurrentId: (id: number) => void;
  push: <T>(entityType: string, items: T[], currentId: number, parentId: number) => void;
  pop: () => void;

  currentIndex: number;
  hasPrev: boolean;
  hasNext: boolean;
  goNext: () => void;
  goPrev: () => void;
  goToIndex: (index: number) => void;
  goHome: () => void;
  goEnd: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export interface NavigationProviderProps {
  children: ReactNode;
  onNavigate?: (entityType: string, id: number) => void;
}

export function NavigationProvider({ children, onNavigate }: NavigationProviderProps) {
  const [stack, setStack] = useState<NavigationLevel[]>([]);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const currentLevel = useMemo(() => {
    return stack.length > 0 ? (stack[stack.length - 1] ?? null) : null;
  }, [stack]);

  const depth = stack.length;

  const currentIndex = useMemo(() => {
    if (!currentLevel) return -1;
    return currentLevel.items.findIndex(
      (item) => (item as { id?: number }).id === currentLevel.currentId
    );
  }, [currentLevel]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentLevel ? currentIndex < currentLevel.items.length - 1 : false;
  const currentId = currentLevel?.currentId ?? null;

  const setItems = useCallback(<T,>(entityType: string, items: T[], currentId: number) => {
    setStack([{ entityType, items, currentId }]);
  }, []);

  // Update current ID without triggering navigation (for syncing state)
  const setCurrentId = useCallback((id: number) => {
    setStack((prev) => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      const lastLevel = newStack[newStack.length - 1];
      if (lastLevel) {
        newStack[newStack.length - 1] = { ...lastLevel, currentId: id };
      }
      return newStack;
    });
  }, []);

  // Navigate to an ID (update state AND trigger onNavigate callback)
  const navigateTo = useCallback((id: number) => {
    setStack((prev) => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      const lastLevel = newStack[newStack.length - 1];
      if (lastLevel) {
        newStack[newStack.length - 1] = { ...lastLevel, currentId: id };
        onNavigateRef.current?.(lastLevel.entityType, id);
      }
      return newStack;
    });
  }, []);

  const push = useCallback(
    <T,>(entityType: string, items: T[], currentId: number, parentId: number) => {
      setStack((prev) => [...prev, { entityType, items, currentId, parentId }]);
      onNavigateRef.current?.(entityType, currentId);
    },
    []
  );

  const pop = useCallback(() => {
    setStack((prev) => {
      if (prev.length <= 1) return prev;
      const newStack = prev.slice(0, -1);
      const parentLevel = newStack[newStack.length - 1];
      if (parentLevel) {
        onNavigateRef.current?.(parentLevel.entityType, parentLevel.currentId);
      }
      return newStack;
    });
  }, []);

  const goNext = useCallback(() => {
    const level = stackRef.current[stackRef.current.length - 1];
    if (!level) return;
    const idx = level.items.findIndex((item) => (item as { id?: number }).id === level.currentId);
    if (idx < 0 || idx >= level.items.length - 1) return;
    const nextItem = level.items[idx + 1] as { id?: number } | undefined;
    if (nextItem?.id !== undefined) {
      navigateTo(nextItem.id);
    }
  }, [navigateTo]);

  const goPrev = useCallback(() => {
    const level = stackRef.current[stackRef.current.length - 1];
    if (!level) return;
    const idx = level.items.findIndex((item) => (item as { id?: number }).id === level.currentId);
    if (idx <= 0) return;
    const prevItem = level.items[idx - 1] as { id?: number } | undefined;
    if (prevItem?.id !== undefined) {
      navigateTo(prevItem.id);
    }
  }, [navigateTo]);

  const goToIndex = useCallback(
    (index: number) => {
      const level = stackRef.current[stackRef.current.length - 1];
      if (!level) return;
      const item = level.items[index] as { id?: number } | undefined;
      if (item?.id !== undefined) {
        navigateTo(item.id);
      }
    },
    [navigateTo]
  );

  const goHome = useCallback(() => {
    goToIndex(0);
  }, [goToIndex]);

  const goEnd = useCallback(() => {
    const level = stackRef.current[stackRef.current.length - 1];
    if (!level) return;
    goToIndex(level.items.length - 1);
  }, [goToIndex]);

  const value: NavigationContextValue = useMemo(
    () => ({
      stack,
      currentLevel,
      depth,
      currentId,
      setItems,
      setCurrentId,
      push,
      pop,
      currentIndex,
      hasPrev,
      hasNext,
      goNext,
      goPrev,
      goToIndex,
      goHome,
      goEnd,
    }),
    [
      stack,
      currentLevel,
      depth,
      currentId,
      setItems,
      setCurrentId,
      push,
      pop,
      currentIndex,
      hasPrev,
      hasNext,
      goNext,
      goPrev,
      goToIndex,
      goHome,
      goEnd,
    ]
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
