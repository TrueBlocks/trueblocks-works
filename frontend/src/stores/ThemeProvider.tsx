import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MantineProvider, MantineColorScheme } from '@mantine/core';
import { GetSettings, UpdateSettings } from '@app';
import { createAppTheme, ThemeName } from '@/theme';
import { Log, LogErr } from '@/utils';

interface ThemeContextValue {
  themeName: ThemeName;
  setTheme: (theme: ThemeName) => Promise<void>;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => Promise<void>;
  toggleDarkMode: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themeName, setThemeName] = useState<ThemeName>('default');
  const [darkMode, setDarkModeState] = useState(false);
  const [theme, setTheme] = useState(() => createAppTheme('default'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    GetSettings()
      .then((settings) => {
        const savedTheme = (settings.theme as ThemeName) || 'default';
        const savedDarkMode = settings.darkMode || false;
        Log('Loaded theme from settings:', savedTheme, 'dark mode:', savedDarkMode);
        setThemeName(savedTheme);
        setDarkModeState(savedDarkMode);
        setTheme(createAppTheme(savedTheme));
      })
      .catch((err) => {
        LogErr('Failed to load theme from settings:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleSetTheme = async (newTheme: ThemeName) => {
    try {
      const settings = await GetSettings();
      settings.theme = newTheme;
      await UpdateSettings(settings);
      setThemeName(newTheme);
      setTheme(createAppTheme(newTheme));
      Log('Theme changed to:', newTheme);
    } catch (err) {
      LogErr('Failed to save theme:', err);
      throw err;
    }
  };

  const handleSetDarkMode = async (dark: boolean) => {
    try {
      const settings = await GetSettings();
      settings.darkMode = dark;
      await UpdateSettings(settings);
      setDarkModeState(dark);
      Log('Dark mode changed to:', dark);
    } catch (err) {
      LogErr('Failed to save dark mode:', err);
      throw err;
    }
  };

  const handleToggleDarkMode = async () => {
    await handleSetDarkMode(!darkMode);
  };

  if (loading) {
    return null;
  }

  const colorScheme: MantineColorScheme = darkMode ? 'dark' : 'light';

  return (
    <ThemeContext.Provider
      value={{
        themeName,
        setTheme: handleSetTheme,
        darkMode,
        setDarkMode: handleSetDarkMode,
        toggleDarkMode: handleToggleDarkMode,
      }}
    >
      <MantineProvider theme={theme} forceColorScheme={colorScheme}>
        {children}
      </MantineProvider>
    </ThemeContext.Provider>
  );
}
