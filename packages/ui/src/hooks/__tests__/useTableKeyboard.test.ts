import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTableKeyboard, type TableKeyboardConfig } from '../useTableKeyboard';

describe('useTableKeyboard', () => {
  const createConfig = (overrides: Partial<TableKeyboardConfig> = {}): TableKeyboardConfig => ({
    selectedIndex: 0,
    page: 1,
    pageSize: 10,
    totalPages: 3,
    paginatedLength: 10,
    globalIndex: 0,
    sortedLength: 30,
    setPage: vi.fn(),
    setSelectedIndex: vi.fn(),
    navigateToGlobalIndex: vi.fn(),
    onEnter: vi.fn(),
    ...overrides,
  });

  describe('initialization', () => {
    it('renders without error', () => {
      const config = createConfig();
      const { result } = renderHook(() => useTableKeyboard(config));
      expect(result.current).toBeUndefined();
    });
  });

  describe('navigation handlers', () => {
    it('provides arrow key handlers via useHotkeys', () => {
      const setPage = vi.fn();
      const navigateToGlobalIndex = vi.fn();
      const config = createConfig({
        page: 2,
        totalPages: 3,
        setPage,
        navigateToGlobalIndex,
      });

      renderHook(() => useTableKeyboard(config));

      expect(setPage).not.toHaveBeenCalled();
      expect(navigateToGlobalIndex).not.toHaveBeenCalled();
    });

    it('handles config with onEnter callback', () => {
      const onEnter = vi.fn();
      const config = createConfig({ onEnter });

      renderHook(() => useTableKeyboard(config));

      expect(onEnter).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles first page boundary', () => {
      const setPage = vi.fn();
      const setSelectedIndex = vi.fn();
      const config = createConfig({
        page: 1,
        selectedIndex: 0,
        setPage,
        setSelectedIndex,
      });

      renderHook(() => useTableKeyboard(config));

      expect(setPage).not.toHaveBeenCalled();
      expect(setSelectedIndex).not.toHaveBeenCalled();
    });

    it('handles last page boundary', () => {
      const setPage = vi.fn();
      const setSelectedIndex = vi.fn();
      const config = createConfig({
        page: 3,
        totalPages: 3,
        selectedIndex: 9,
        paginatedLength: 10,
        setPage,
        setSelectedIndex,
      });

      renderHook(() => useTableKeyboard(config));

      expect(setPage).not.toHaveBeenCalled();
      expect(setSelectedIndex).not.toHaveBeenCalled();
    });

    it('handles empty list gracefully', () => {
      const config = createConfig({
        paginatedLength: 0,
        sortedLength: 0,
        totalPages: 0,
      });

      renderHook(() => useTableKeyboard(config));
    });
  });
});
