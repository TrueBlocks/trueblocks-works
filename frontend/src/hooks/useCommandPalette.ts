import { useState, useCallback, useEffect } from 'react';
import type { Command, CommandScope } from '@/commands';
import { getCommandsForScope, filterCommands } from '@/commands';

interface UseCommandPaletteOptions {
  scope: CommandScope;
  enabled?: boolean;
}

interface UseCommandPaletteReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  query: string;
  setQuery: (q: string) => void;
  filteredCommands: Command[];
  selectedIndex: number;
  setSelectedIndex: (i: number) => void;
  selectNext: () => void;
  selectPrevious: () => void;
}

export function useCommandPalette({
  scope,
  enabled = true,
}: UseCommandPaletteOptions): UseCommandPaletteReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scopeCommands = getCommandsForScope(scope);
  const filteredCommands = filterCommands(scopeCommands, query);

  const open = useCallback(() => {
    if (enabled) {
      setIsOpen(true);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [enabled]);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  const selectNext = useCallback(() => {
    setSelectedIndex((i) => (i + 1) % filteredCommands.length);
  }, [filteredCommands.length]);

  const selectPrevious = useCallback(() => {
    setSelectedIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
  }, [filteredCommands.length]);

  // Wrap setQuery to also reset selection
  const handleSetQuery = useCallback((q: string) => {
    setQuery(q);
    setSelectedIndex(0);
  }, []);

  // Cmd+Shift+P keyboard shortcut
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        toggle();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, toggle]);

  return {
    isOpen,
    open,
    close,
    toggle,
    query,
    setQuery: handleSetQuery,
    filteredCommands,
    selectedIndex,
    setSelectedIndex,
    selectNext,
    selectPrevious,
  };
}
