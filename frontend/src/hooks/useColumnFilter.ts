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
  const [selected, setSelectedState] = useState<Set<string>>(() => new Set(availableOptions));
  const persistFnRef = useRef(persistFn);
  const availableOptionsRef = useRef(availableOptions);
  const prevOptionsRef = useRef<Set<string>>(new Set(availableOptions));

  useEffect(() => {
    persistFnRef.current = persistFn;
  }, [persistFn]);

  useEffect(() => {
    availableOptionsRef.current = availableOptions;
    const prevOptions = prevOptionsRef.current;
    const currentOptions = new Set(availableOptions);
    const newOptions = availableOptions.filter((opt) => !prevOptions.has(opt));
    prevOptionsRef.current = currentOptions;

    if (newOptions.length > 0) {
      setSelectedState((prev) => {
        const nextSelected = new Set(prev);
        newOptions.forEach((opt) => nextSelected.add(opt));
        return nextSelected;
      });
    } else if (availableOptions.length === 0 && prevOptions.size > 0) {
      setSelectedState(new Set());
    }
  }, [availableOptions]);

  const initialize = useCallback((values: Set<string>) => {
    setSelectedState(values);
    prevOptionsRef.current = values;
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
