import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTableState, type ColumnConfig } from '../useTableState';
import { testItems, emptyItems, type TestItem } from '../../test/fixtures';

describe('useTableState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  const columns: ColumnConfig<TestItem>[] = [
    { key: 'name' },
    { key: 'status', filterOptions: ['active', 'pending', 'inactive'] },
    { key: 'count' },
  ];

  const searchFn = (item: TestItem, query: string): boolean => {
    const q = query.toLowerCase();
    return item.name.toLowerCase().includes(q) || item.status.toLowerCase().includes(q);
  };

  describe('initialization', () => {
    it('returns all items when no filters applied', () => {
      const { result } = renderHook(() => useTableState({ data: testItems, columns }));

      expect(result.current.filteredData).toHaveLength(testItems.length);
    });

    it('handles empty data', () => {
      const { result } = renderHook(() => useTableState({ data: emptyItems, columns }));

      expect(result.current.filteredData).toHaveLength(0);
    });
  });

  describe('search', () => {
    it('filters items by search query', () => {
      const { result } = renderHook(() => useTableState({ data: testItems, columns, searchFn }));

      act(() => {
        result.current.setSearch('alpha');
      });

      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(result.current.filteredData).toHaveLength(1);
      expect(result.current.filteredData[0]?.name).toBe('Alpha');
    });

    it('search is case-insensitive', () => {
      const { result } = renderHook(() => useTableState({ data: testItems, columns, searchFn }));

      act(() => {
        result.current.setSearch('BETA');
      });

      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(result.current.filteredData).toHaveLength(1);
      expect(result.current.filteredData[0]?.name).toBe('Beta');
    });

    it('returns empty when no matches', () => {
      const { result } = renderHook(() => useTableState({ data: testItems, columns, searchFn }));

      act(() => {
        result.current.setSearch('zzzzz');
      });

      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(result.current.filteredData).toHaveLength(0);
    });

    it('clears search', () => {
      const { result } = renderHook(() => useTableState({ data: testItems, columns, searchFn }));

      act(() => {
        result.current.setSearch('alpha');
      });
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(result.current.filteredData).toHaveLength(1);

      act(() => {
        result.current.setSearch('');
      });
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(result.current.filteredData).toHaveLength(testItems.length);
    });
  });

  describe('sorting', () => {
    it('sorts by string column ascending', () => {
      const { result } = renderHook(() => useTableState({ data: testItems, columns }));

      act(() => {
        result.current.handleColumnClick('name', true);
      });

      const names = result.current.sortedData.map((item) => item.name);
      expect(names).toEqual(['Alpha', 'Beta', 'Delta', 'Epsilon', 'Gamma']);
    });

    it('sorts by string column descending', () => {
      const { result } = renderHook(() => useTableState({ data: testItems, columns }));

      act(() => {
        // First click: asc
        result.current.handleColumnClick('name', true);
      });
      act(() => {
        // Second click: desc
        result.current.handleColumnClick('name', false);
      });

      const names = result.current.sortedData.map((item) => item.name);
      expect(names).toEqual(['Gamma', 'Epsilon', 'Delta', 'Beta', 'Alpha']);
    });

    it('sorts by number column', () => {
      const { result } = renderHook(() => useTableState({ data: testItems, columns }));

      act(() => {
        result.current.handleColumnClick('count', true);
      });

      const counts = result.current.sortedData.map((item) => item.count);
      expect(counts).toEqual([0, 5, 10, 15, 20]);
    });
  });

  describe('pagination', () => {
    it('returns correct page of data', () => {
      const { result } = renderHook(() =>
        useTableState({ data: testItems, columns, initialPageSize: 2 })
      );

      expect(result.current.paginatedData).toHaveLength(2);
      expect(result.current.totalPages).toBe(3);
    });

    it('navigates to next page', () => {
      const { result } = renderHook(() =>
        useTableState({ data: testItems, columns, initialPageSize: 2 })
      );

      const firstPageIds = result.current.paginatedData.map((item) => item.id);

      act(() => {
        result.current.setPage(2);
      });

      const secondPageIds = result.current.paginatedData.map((item) => item.id);
      expect(secondPageIds).not.toEqual(firstPageIds);
    });

    it('resets to page 1 when search changes', () => {
      const { result } = renderHook(() =>
        useTableState({ data: testItems, columns, initialPageSize: 2, searchFn })
      );

      act(() => {
        result.current.setPage(2);
      });
      expect(result.current.page).toBe(2);

      act(() => {
        result.current.setSearch('alpha');
      });
      expect(result.current.page).toBe(1);
    });
  });

  describe('filters', () => {
    it('filters by set filter', () => {
      const { result } = renderHook(() => useTableState({ data: testItems, columns }));

      act(() => {
        result.current.handleFilterSelectOnly('status', 'active');
      });

      expect(result.current.filteredData).toHaveLength(2);
      expect(result.current.filteredData.every((item) => item.status === 'active')).toBe(true);
    });

    it('clears filter by selecting all', () => {
      const { result } = renderHook(() => useTableState({ data: testItems, columns }));

      act(() => {
        result.current.handleFilterSelectOnly('status', 'active');
      });
      expect(result.current.filteredData).toHaveLength(2);

      act(() => {
        result.current.handleFilterSelectAll('status');
      });
      expect(result.current.filteredData).toHaveLength(testItems.length);
    });

    it('clears all with handleClearAll', () => {
      const { result } = renderHook(() => useTableState({ data: testItems, columns, searchFn }));

      act(() => {
        result.current.handleFilterSelectOnly('status', 'active');
        result.current.setSearch('gamma');
      });

      act(() => {
        result.current.handleClearAll();
      });

      expect(result.current.hasActiveFilters).toBe(false);
      expect(result.current.search).toBe('');
    });
  });

  describe('combined operations', () => {
    it('sort + pagination work together', () => {
      const { result } = renderHook(() =>
        useTableState({ data: testItems, columns, initialPageSize: 2 })
      );

      act(() => {
        result.current.handleColumnClick('name', true);
      });

      const names = result.current.paginatedData.map((item) => item.name);
      expect(names).toEqual(['Alpha', 'Beta']);
    });

    it('filter + sort + pagination work together', () => {
      const { result } = renderHook(() =>
        useTableState({ data: testItems, columns, initialPageSize: 2 })
      );

      act(() => {
        result.current.handleFilterSelectOnly('status', 'active');
        result.current.handleColumnClick('count', true);
      });

      // active: Alpha(10), Gamma(20)
      // sorted by count asc: Alpha(10), Gamma(20)
      expect(result.current.sortedData.map((i) => i.count)).toEqual([10, 20]);
      expect(result.current.paginatedData).toHaveLength(2);
    });
  });
});
