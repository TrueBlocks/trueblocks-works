import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const shortcuts: Record<string, string> = {
  '1': '/works',
  '2': '/organizations',
  '3': '/submissions',
  '4': '/collections',
  '5': '/reports',
  '6': '/settings',
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
