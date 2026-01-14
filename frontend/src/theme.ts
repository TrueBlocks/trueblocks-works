import { createTheme, MantineColorsTuple } from '@mantine/core';

// Pink Cadillac - Vibrant pink/magenta theme
const pinkCadillac: MantineColorsTuple = [
  '#ffe9f5',
  '#ffd1e6',
  '#faa2ca',
  '#f66fac',
  '#f24793',
  '#f03184',
  '#f0267d',
  '#d61a6a',
  '#c0155f',
  '#a90c52',
];

// Green Garden - Natural green theme
const greenGarden: MantineColorsTuple = [
  '#e7f9f0',
  '#d3efe1',
  '#a8dfc2',
  '#7acea1',
  '#54bf85',
  '#3bb572',
  '#2bb068',
  '#1d9a58',
  '#11894e',
  '#007641',
];

export type ThemeName = 'default' | 'pink-cadillac' | 'green-garden';

interface ThemeConfig {
  primaryColor: string;
  colors?: Record<string, MantineColorsTuple>;
}

const themeConfigs: Record<ThemeName, ThemeConfig> = {
  default: {
    primaryColor: 'blue',
  },
  'pink-cadillac': {
    primaryColor: 'pink',
    colors: { pink: pinkCadillac },
  },
  'green-garden': {
    primaryColor: 'green',
    colors: { green: greenGarden },
  },
};

export function createAppTheme(themeName: ThemeName = 'default') {
  const config = themeConfigs[themeName];

  return createTheme({
    primaryColor: config.primaryColor,
    ...(config.colors && { colors: config.colors }),
    fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
    headings: {
      fontFamily:
        '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
    },
    defaultRadius: 'sm',
    cursorType: 'pointer',
    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
    },
    fontSizes: {
      xs: '12px',
      sm: '14px',
      md: '16px',
      lg: '18px',
      xl: '20px',
    },
    components: {
      Stack: {
        defaultProps: {
          gap: 'md',
        },
      },
      Paper: {
        defaultProps: {
          p: 'md',
          withBorder: true,
        },
      },
      Tabs: {
        defaultProps: {
          keepMounted: false,
        },
      },
    },
  });
}

// Default theme export for backwards compatibility
export const theme = createAppTheme('default');
