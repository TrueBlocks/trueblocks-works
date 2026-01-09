import { Switch } from '@mantine/core';
import { useTheme } from '@/stores';

export function DarkModeSwitch() {
  const { darkMode, setDarkMode } = useTheme();

  return (
    <Switch
      label="Dark Mode"
      description="Toggle between light and dark theme"
      checked={darkMode}
      onChange={(event) => setDarkMode(event.currentTarget.checked)}
    />
  );
}
