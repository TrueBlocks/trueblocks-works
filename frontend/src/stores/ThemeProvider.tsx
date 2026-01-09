import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import { GetSettings, UpdateSettings } from '@wailsjs/go/main/App';
import { createAppTheme, ThemeName } from '@/theme';
import { Log, LogErr } from '@/utils';

interface ThemeContextValue {
  themeName: ThemeName;
  setTheme: (theme: ThemeName) => Promise<void>;
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
  const [theme, setTheme] = useState(() => createAppTheme('default'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    GetSettings()
      .then((settings) => {
        const savedTheme = (settings.theme as ThemeName) || 'default';
        Log('Loaded theme from settings:', savedTheme);
        setThemeName(savedTheme);
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

  if (loading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ themeName, setTheme: handleSetTheme }}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        {children}
      </MantineProvider>
    </ThemeContext.Provider>
  );
}
