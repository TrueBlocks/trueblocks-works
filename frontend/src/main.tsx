import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';
import { theme } from '@/theme';
import App from './App';

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <MantineProvider theme={theme} defaultColorScheme="light">
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </MantineProvider>
);
