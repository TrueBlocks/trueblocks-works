import { useHotkeys } from '@mantine/hooks';
import { RefObject, useCallback } from 'react';

export interface TableKeyboardConfig {
  selectedIndex: number;
  page: number;
  pageSize: number;
  totalPages: number;
  paginatedLength: number;
  globalIndex: number;
  sortedLength: number;
  setPage: (page: number) => void;
  setSelectedIndex: (index: number) => void;
  navigateToGlobalIndex: (index: number) => void;
  onEnter?: () => void;
  searchRef?: RefObject<HTMLInputElement>;
}

export function useTableKeyboard(config: TableKeyboardConfig): void {
  const {
    selectedIndex,
    page,
    totalPages,
    paginatedLength,
    globalIndex,
    sortedLength,
    setPage,
    setSelectedIndex,
    navigateToGlobalIndex,
    onEnter,
    searchRef,
  } = config;

  const handleArrowRight = useCallback(() => {
    if (page < totalPages) {
      setPage(page + 1);
    } else if (selectedIndex < paginatedLength - 1) {
      setSelectedIndex(paginatedLength - 1);
    }
  }, [page, totalPages, selectedIndex, paginatedLength, setPage, setSelectedIndex]);

  const handleArrowLeft = useCallback(() => {
    if (page > 1) {
      setPage(page - 1);
    } else if (selectedIndex > 0) {
      setSelectedIndex(0);
    }
  }, [page, selectedIndex, setPage, setSelectedIndex]);

  const handleArrowDown = useCallback(() => {
    navigateToGlobalIndex(globalIndex + 1);
  }, [navigateToGlobalIndex, globalIndex]);

  const handleArrowUp = useCallback(() => {
    navigateToGlobalIndex(globalIndex - 1);
  }, [navigateToGlobalIndex, globalIndex]);

  const handleHome = useCallback(() => {
    navigateToGlobalIndex(0);
  }, [navigateToGlobalIndex]);

  const handleEnd = useCallback(() => {
    navigateToGlobalIndex(sortedLength - 1);
  }, [navigateToGlobalIndex, sortedLength]);

  const handleEnter = useCallback(() => {
    onEnter?.();
  }, [onEnter]);

  const handleFocusSearch = useCallback(() => {
    searchRef?.current?.focus();
  }, [searchRef]);

  useHotkeys([
    ['mod+/', handleFocusSearch],
    ['ArrowRight', handleArrowRight],
    ['ArrowLeft', handleArrowLeft],
    ['ArrowDown', handleArrowDown],
    ['ArrowUp', handleArrowUp],
    ['Home', handleHome],
    ['End', handleEnd],
    ['Enter', handleEnter],
  ]);
}
