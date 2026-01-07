import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const shortcuts: Record<string, string> = {
  '1': '/dashboard',
  '2': '/collections',
  '3': '/works',
  '4': '/organizations',
  '5': '/submissions',
  '6': '/reports',
  '7': '/settings',
};

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey && shortcuts[e.key]) {
        e.preventDefault();
        navigate(shortcuts[e.key]);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
}
