import { Switch, SwitchProps } from '@mantine/core';

export interface DarkModeSwitchProps extends Omit<SwitchProps, 'checked' | 'onChange'> {
  darkMode: boolean;
  onDarkModeChange: (darkMode: boolean) => void;
}

export function DarkModeSwitch({
  darkMode,
  onDarkModeChange,
  label = 'Dark Mode',
  description = 'Toggle between light and dark theme',
  ...rest
}: DarkModeSwitchProps) {
  return (
    <Switch
      label={label}
      description={description}
      checked={darkMode}
      onChange={(event) => onDarkModeChange(event.currentTarget.checked)}
      {...rest}
    />
  );
}
