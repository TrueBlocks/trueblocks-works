import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export interface KeyboardShortcutProps {
  currentIndex: number;
  totalRecords: number;
  onNavigate: (index: number) => void;
  viewMode: 'form' | 'table';
  onToggleView?: () => void;
  onNewRecord?: () => void;
  onSaveRecord?: () => void;
  onFind?: () => void;
  onCancel?: () => void;
}

/**
 * Hook for handling keyboard shortcuts in the application.
 * 
 * Global shortcuts (⌘1-4) work regardless of focus.
 * Record navigation (↑/↓) and action shortcuts work when not in input fields.
 * 
 * @param props - Optional record navigation and action callbacks
 */
export function useKeyboardShortcuts(props?: KeyboardShortcutProps) {
  const navigate = useNavigate();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const isMeta = event.metaKey || event.ctrlKey;
    const isShift = event.shiftKey;

    // Check if user is typing in an input field
    const target = event.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' || 
                         target.tagName === 'TEXTAREA' || 
                         target.tagName === 'SELECT' ||
                         target.isContentEditable;

    // Global navigation shortcuts (⌘1-4) - always work
    if (isMeta && event.key >= '1' && event.key <= '4') {
      event.preventDefault();
      const routes = ['/', '/works', '/submissions', '/organizations'];
      const index = parseInt(event.key) - 1;
      navigate(routes[index]);
      return;
    }

    // Skip other shortcuts if in input field (unless Escape)
    if (isInputField && event.key !== 'Escape') {
      return;
    }

    // Record navigation shortcuts
    if (props) {
      const { 
        currentIndex, 
        totalRecords, 
        onNavigate, 
        onToggleView, 
        onNewRecord, 
        onSaveRecord, 
        onFind, 
        onCancel 
      } = props;

      switch (event.key) {
        case 'ArrowDown':
          if (currentIndex < totalRecords - 1) {
            event.preventDefault();
            onNavigate(currentIndex + 1);
          }
          break;

        case 'ArrowUp':
          if (currentIndex > 0) {
            event.preventDefault();
            onNavigate(currentIndex - 1);
          }
          break;

        case 'Home':
          if (isMeta || isShift) {
            event.preventDefault();
            onNavigate(0);
          }
          break;

        case 'End':
          if (isMeta || isShift) {
            event.preventDefault();
            onNavigate(totalRecords - 1);
          }
          break;

        case 'v':
          if (isMeta && onToggleView) {
            event.preventDefault();
            onToggleView();
          }
          break;

        case 'n':
          if (isMeta && onNewRecord) {
            event.preventDefault();
            onNewRecord();
          }
          break;

        case 's':
          if (isMeta && onSaveRecord) {
            event.preventDefault();
            onSaveRecord();
          }
          break;

        case 'f':
          if (isMeta && onFind) {
            event.preventDefault();
            onFind();
          }
          break;

        case 'Escape':
          if (onCancel) {
            event.preventDefault();
            onCancel();
          }
          break;
      }
    }
  }, [navigate, props]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Simplified hook for global navigation only (for App.tsx or pages without records)
 */
export function useGlobalKeyboardShortcuts() {
  const navigate = useNavigate();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const isMeta = event.metaKey || event.ctrlKey;

    // Global navigation shortcuts (⌘1-4)
    if (isMeta && event.key >= '1' && event.key <= '4') {
      event.preventDefault();
      const routes = ['/', '/works', '/submissions', '/organizations'];
      const index = parseInt(event.key) - 1;
      navigate(routes[index]);
    }
  }, [navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
