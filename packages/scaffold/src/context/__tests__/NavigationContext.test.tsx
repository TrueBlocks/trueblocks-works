import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { NavigationProvider, useNavigation } from '../NavigationContext';
import type { ReactNode } from 'react';

const wrapper = ({ children }: { children: ReactNode }) => (
  <NavigationProvider>{children}</NavigationProvider>
);

const wrapperWithCallback = (onNavigate: (entityType: string, id: number) => void) => {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <NavigationProvider onNavigate={onNavigate}>{children}</NavigationProvider>;
  };
};

describe('NavigationContext', () => {
  describe('initialization', () => {
    it('provides default values when empty', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      expect(result.current.stack).toEqual([]);
      expect(result.current.currentLevel).toBeNull();
      expect(result.current.depth).toBe(0);
      expect(result.current.currentId).toBeNull();
      expect(result.current.currentIndex).toBe(-1);
      expect(result.current.hasPrev).toBe(false);
      expect(result.current.hasNext).toBe(false);
    });

    it('throws when useNavigation is used outside provider', () => {
      const originalError = console.error;
      console.error = vi.fn();
      try {
        expect(() => {
          renderHook(() => useNavigation());
        }).toThrow('useNavigation must be used within a NavigationProvider');
      } finally {
        console.error = originalError;
      }
    });
  });

  describe('setItems', () => {
    it('sets items and currentId', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setItems('works', [{ id: 1 }, { id: 2 }, { id: 3 }], 2);
      });

      expect(result.current.stack).toHaveLength(1);
      expect(result.current.currentLevel?.entityType).toBe('works');
      expect(result.current.currentLevel?.items).toHaveLength(3);
      expect(result.current.currentId).toBe(2);
      expect(result.current.depth).toBe(1);
    });

    it('replaces existing stack', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setItems('works', [{ id: 1 }], 1);
      });
      act(() => {
        result.current.setItems('collections', [{ id: 10 }, { id: 20 }], 10);
      });

      expect(result.current.stack).toHaveLength(1);
      expect(result.current.currentLevel?.entityType).toBe('collections');
    });
  });

  describe('setCurrentId', () => {
    it('updates currentId without triggering onNavigate', () => {
      const onNavigate = vi.fn();
      const { result } = renderHook(() => useNavigation(), {
        wrapper: wrapperWithCallback(onNavigate),
      });

      act(() => {
        result.current.setItems('works', [{ id: 1 }, { id: 2 }], 1);
      });
      onNavigate.mockClear();

      act(() => {
        result.current.setCurrentId(2);
      });

      expect(result.current.currentId).toBe(2);
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  describe('currentIndex and navigation flags', () => {
    it('calculates currentIndex correctly', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setItems('works', [{ id: 10 }, { id: 20 }, { id: 30 }], 20);
      });

      expect(result.current.currentIndex).toBe(1);
    });

    it('sets hasPrev and hasNext correctly', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setItems('works', [{ id: 1 }, { id: 2 }, { id: 3 }], 2);
      });

      expect(result.current.hasPrev).toBe(true);
      expect(result.current.hasNext).toBe(true);
    });

    it('hasPrev is false at first item', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setItems('works', [{ id: 1 }, { id: 2 }, { id: 3 }], 1);
      });

      expect(result.current.hasPrev).toBe(false);
      expect(result.current.hasNext).toBe(true);
    });

    it('hasNext is false at last item', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setItems('works', [{ id: 1 }, { id: 2 }, { id: 3 }], 3);
      });

      expect(result.current.hasPrev).toBe(true);
      expect(result.current.hasNext).toBe(false);
    });
  });

  describe('goNext and goPrev', () => {
    it('goNext moves to next item', () => {
      const onNavigate = vi.fn();
      const { result } = renderHook(() => useNavigation(), {
        wrapper: wrapperWithCallback(onNavigate),
      });

      act(() => {
        result.current.setItems('works', [{ id: 1 }, { id: 2 }, { id: 3 }], 1);
      });
      onNavigate.mockClear();

      act(() => {
        result.current.goNext();
      });

      expect(result.current.currentId).toBe(2);
      expect(onNavigate).toHaveBeenCalledWith('works', 2);
    });

    it('goPrev moves to previous item', () => {
      const onNavigate = vi.fn();
      const { result } = renderHook(() => useNavigation(), {
        wrapper: wrapperWithCallback(onNavigate),
      });

      act(() => {
        result.current.setItems('works', [{ id: 1 }, { id: 2 }, { id: 3 }], 3);
      });
      onNavigate.mockClear();

      act(() => {
        result.current.goPrev();
      });

      expect(result.current.currentId).toBe(2);
      expect(onNavigate).toHaveBeenCalledWith('works', 2);
    });

    it('goNext does nothing at end', () => {
      const onNavigate = vi.fn();
      const { result } = renderHook(() => useNavigation(), {
        wrapper: wrapperWithCallback(onNavigate),
      });

      act(() => {
        result.current.setItems('works', [{ id: 1 }, { id: 2 }], 2);
      });
      onNavigate.mockClear();

      act(() => {
        result.current.goNext();
      });

      expect(result.current.currentId).toBe(2);
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('goPrev does nothing at start', () => {
      const onNavigate = vi.fn();
      const { result } = renderHook(() => useNavigation(), {
        wrapper: wrapperWithCallback(onNavigate),
      });

      act(() => {
        result.current.setItems('works', [{ id: 1 }, { id: 2 }], 1);
      });
      onNavigate.mockClear();

      act(() => {
        result.current.goPrev();
      });

      expect(result.current.currentId).toBe(1);
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  describe('goHome and goEnd', () => {
    it('goHome moves to first item', () => {
      const onNavigate = vi.fn();
      const { result } = renderHook(() => useNavigation(), {
        wrapper: wrapperWithCallback(onNavigate),
      });

      act(() => {
        result.current.setItems('works', [{ id: 1 }, { id: 2 }, { id: 3 }], 3);
      });
      onNavigate.mockClear();

      act(() => {
        result.current.goHome();
      });

      expect(result.current.currentId).toBe(1);
      expect(onNavigate).toHaveBeenCalledWith('works', 1);
    });

    it('goEnd moves to last item', () => {
      const onNavigate = vi.fn();
      const { result } = renderHook(() => useNavigation(), {
        wrapper: wrapperWithCallback(onNavigate),
      });

      act(() => {
        result.current.setItems('works', [{ id: 1 }, { id: 2 }, { id: 3 }], 1);
      });
      onNavigate.mockClear();

      act(() => {
        result.current.goEnd();
      });

      expect(result.current.currentId).toBe(3);
      expect(onNavigate).toHaveBeenCalledWith('works', 3);
    });
  });

  describe('goToIndex', () => {
    it('navigates to specific index', () => {
      const onNavigate = vi.fn();
      const { result } = renderHook(() => useNavigation(), {
        wrapper: wrapperWithCallback(onNavigate),
      });

      act(() => {
        result.current.setItems('works', [{ id: 10 }, { id: 20 }, { id: 30 }], 10);
      });
      onNavigate.mockClear();

      act(() => {
        result.current.goToIndex(2);
      });

      expect(result.current.currentId).toBe(30);
      expect(onNavigate).toHaveBeenCalledWith('works', 30);
    });

    it('handles out of bounds index gracefully', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setItems('works', [{ id: 1 }, { id: 2 }], 1);
      });

      act(() => {
        result.current.goToIndex(100);
      });

      expect(result.current.currentId).toBe(1);
    });
  });

  describe('push and pop (hierarchy)', () => {
    it('push adds a new level to stack', () => {
      const onNavigate = vi.fn();
      const { result } = renderHook(() => useNavigation(), {
        wrapper: wrapperWithCallback(onNavigate),
      });

      act(() => {
        result.current.setItems('collections', [{ id: 1 }], 1);
      });
      onNavigate.mockClear();

      act(() => {
        result.current.push('works', [{ id: 10 }, { id: 20 }], 10, 1);
      });

      expect(result.current.depth).toBe(2);
      expect(result.current.currentLevel?.entityType).toBe('works');
      expect(result.current.currentId).toBe(10);
      expect(onNavigate).toHaveBeenCalledWith('works', 10);
    });

    it('pop removes top level and returns to parent', () => {
      const onNavigate = vi.fn();
      const { result } = renderHook(() => useNavigation(), {
        wrapper: wrapperWithCallback(onNavigate),
      });

      act(() => {
        result.current.setItems('collections', [{ id: 1 }], 1);
        result.current.push('works', [{ id: 10 }], 10, 1);
      });
      onNavigate.mockClear();

      act(() => {
        result.current.pop();
      });

      expect(result.current.depth).toBe(1);
      expect(result.current.currentLevel?.entityType).toBe('collections');
      expect(result.current.currentId).toBe(1);
      expect(onNavigate).toHaveBeenCalledWith('collections', 1);
    });

    it('pop does nothing when at root level', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setItems('works', [{ id: 1 }], 1);
      });

      act(() => {
        result.current.pop();
      });

      expect(result.current.depth).toBe(1);
    });
  });
});
