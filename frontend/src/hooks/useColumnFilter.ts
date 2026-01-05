import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

type PersistFn = (values: string[]) => void;

interface UseColumnFilterResult {
  selected: Set<string>;
  toggle: (value: string) => void;
  selectAll: () => void;
  selectNone: () => void;
  selectOnly: (value: string) => void;
  addValue: (value: string) => void;
  initialize: (values: Set<string>) => void;
}

export function useColumnFilter(
  availableOptions: string[],
  persistFn?: PersistFn
): UseColumnFilterResult {
  const [selected, setSelectedState] = useState<Set<string>>(new Set(availableOptions));
  const persistFnRef = useRef(persistFn);
  const availableOptionsRef = useRef(availableOptions);

  useEffect(() => {
    persistFnRef.current = persistFn;
  }, [persistFn]);

  useEffect(() => {
    availableOptionsRef.current = availableOptions;
  }, [availableOptions]);

  const initialize = useCallback((values: Set<string>) => {
    setSelectedState(values);
  }, []);

  const toggle = useCallback((value: string) => {
    setSelectedState((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      persistFnRef.current?.(Array.from(next));
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allSet = new Set(availableOptionsRef.current);
    setSelectedState(allSet);
    persistFnRef.current?.(Array.from(allSet));
  }, []);

  const selectNone = useCallback(() => {
    const emptySet = new Set<string>();
    setSelectedState(emptySet);
    persistFnRef.current?.([]);
  }, []);

  const selectOnly = useCallback((value: string) => {
    const singleSet = new Set([value]);
    setSelectedState(singleSet);
    persistFnRef.current?.([value]);
  }, []);

  const addValue = useCallback((value: string) => {
    setSelectedState((prev) => {
      if (prev.has(value)) return prev;
      const next = new Set(prev);
      next.add(value);
      persistFnRef.current?.(Array.from(next));
      return next;
    });
  }, []);

  return useMemo(
    () => ({
      selected,
      toggle,
      selectAll,
      selectNone,
      selectOnly,
      addValue,
      initialize,
    }),
    [selected, toggle, selectAll, selectNone, selectOnly, addValue, initialize]
  );
}
