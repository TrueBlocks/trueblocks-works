import { ActionIcon, Tooltip } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { useTheme } from '@/stores';

export function DarkModeToggle() {
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <Tooltip label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
      <ActionIcon variant="subtle" onClick={toggleDarkMode} size="lg">
        {darkMode ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}
