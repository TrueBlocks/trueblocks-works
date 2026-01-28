import { DarkModeSwitch as BaseDarkModeSwitch } from '@trueblocks/ui';
import { useTheme } from '@/stores';

export function DarkModeSwitch() {
  const { darkMode, setDarkMode } = useTheme();

  return <BaseDarkModeSwitch darkMode={darkMode} onDarkModeChange={setDarkMode} />;
}
