import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTablePersistence, type SerializedTableState } from '../useTablePersistence';
import type { TableState, ViewSort, SortColumn } from '../useTableState';

describe('useTablePersistence', () => {
  const emptySortColumn: SortColumn = { column: '', direction: '' };
  const emptyViewSort: ViewSort = {
    primary: emptySortColumn,
    secondary: emptySortColumn,
    tertiary: emptySortColumn,
    quaternary: emptySortColumn,
  };

  const createTableState = (): TableState => ({
    search: '',
    page: 1,
    pageSize: 10,
    sort: emptyViewSort,
    filters: {},
    rangeFilters: {},
    selectedIndex: 0,
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe('initialization', () => {
    it('returns isLoaded after load completes', async () => {
      const state = createTableState();
      const load = vi.fn().mockResolvedValue(null);
      const save = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useTablePersistence({
          tableName: 'test',
          getState: () => state,
          setState: vi.fn(),
          load,
          save,
        })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(load).toHaveBeenCalledWith('test');
      expect(result.current.isLoaded).toBeDefined();
    });

    it('handles empty saved state', async () => {
      const state = createTableState();
      const load = vi.fn().mockResolvedValue(null);
      const save = vi.fn().mockResolvedValue(undefined);
      const setState = vi.fn();

      renderHook(() =>
        useTablePersistence({
          tableName: 'test',
          getState: () => state,
          setState,
          load,
          save,
        })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(setState).not.toHaveBeenCalled();
    });
  });

  describe('state restoration', () => {
    it('restores search from saved state', async () => {
      const state = createTableState();
      const savedState: SerializedTableState = { search: 'hello' };
      const load = vi.fn().mockResolvedValue(savedState);
      const save = vi.fn().mockResolvedValue(undefined);
      const setState = vi.fn();

      renderHook(() =>
        useTablePersistence({
          tableName: 'test',
          getState: () => state,
          setState,
          load,
          save,
        })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(setState).toHaveBeenCalledWith(expect.objectContaining({ search: 'hello' }));
    });

    it('restores page and pageSize from saved state', async () => {
      const state = createTableState();
      const savedState: SerializedTableState = { page: 3, pageSize: 25 };
      const load = vi.fn().mockResolvedValue(savedState);
      const save = vi.fn().mockResolvedValue(undefined);
      const setState = vi.fn();

      renderHook(() =>
        useTablePersistence({
          tableName: 'test',
          getState: () => state,
          setState,
          load,
          save,
        })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(setState).toHaveBeenCalledWith(expect.objectContaining({ page: 3, pageSize: 25 }));
    });

    it('restores sort from saved state', async () => {
      const state = createTableState();
      const testSort: ViewSort = {
        primary: { column: 'name', direction: 'asc' },
        secondary: emptySortColumn,
        tertiary: emptySortColumn,
        quaternary: emptySortColumn,
      };
      const savedState: SerializedTableState = { sort: testSort };
      const load = vi.fn().mockResolvedValue(savedState);
      const save = vi.fn().mockResolvedValue(undefined);
      const setState = vi.fn();

      renderHook(() =>
        useTablePersistence({
          tableName: 'test',
          getState: () => state,
          setState,
          load,
          save,
        })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(setState).toHaveBeenCalledWith(expect.objectContaining({ sort: testSort }));
    });

    it('restores filters from saved state', async () => {
      const state = createTableState();
      const savedState: SerializedTableState = {
        filters: { status: ['active', 'pending'] },
      };
      const load = vi.fn().mockResolvedValue(savedState);
      const save = vi.fn().mockResolvedValue(undefined);
      const setState = vi.fn();

      renderHook(() =>
        useTablePersistence({
          tableName: 'test',
          getState: () => state,
          setState,
          load,
          save,
        })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(setState).toHaveBeenCalled();
      const call = setState.mock.calls[0]?.[0];
      expect(call?.filters?.status).toBeInstanceOf(Set);
      expect(Array.from(call?.filters?.status ?? [])).toEqual(['active', 'pending']);
    });
  });

  describe('edge cases', () => {
    it('uses custom debounceMs', async () => {
      const state = createTableState();
      const load = vi.fn().mockResolvedValue(null);
      const save = vi.fn().mockResolvedValue(undefined);

      renderHook(() =>
        useTablePersistence({
          tableName: 'test',
          getState: () => state,
          setState: vi.fn(),
          load,
          save,
          debounceMs: 500,
        })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(load).toHaveBeenCalled();
    });

    it('handles unmount during load', async () => {
      const state = createTableState();
      let resolveLoad: ((value: SerializedTableState | null) => void) | undefined;
      const loadPromise = new Promise<SerializedTableState | null>((resolve) => {
        resolveLoad = resolve;
      });
      const load = vi.fn().mockReturnValue(loadPromise);
      const save = vi.fn().mockResolvedValue(undefined);
      const setState = vi.fn();

      const { unmount } = renderHook(() =>
        useTablePersistence({
          tableName: 'test',
          getState: () => state,
          setState,
          load,
          save,
        })
      );

      unmount();

      await act(async () => {
        resolveLoad?.({ search: 'should-not-restore' });
        await vi.runAllTimersAsync();
      });

      expect(setState).not.toHaveBeenCalled();
    });
  });
});
