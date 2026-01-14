import { Select } from '@mantine/core';
import { useTheme } from '@/stores';
import { ThemeName } from '@/theme';

const themeOptions: { value: ThemeName; label: string }[] = [
  { value: 'default', label: 'Default Blue' },
  { value: 'pink-cadillac', label: 'Pink Cadillac' },
  { value: 'green-garden', label: 'Green Garden' },
];

export function ThemeSelector() {
  const { themeName, setTheme } = useTheme();

  return (
    <Select
      label="Theme"
      description="Choose a color theme for the application"
      value={themeName}
      onChange={(value) => setTheme(value as ThemeName)}
      data={themeOptions}
    />
  );
}
