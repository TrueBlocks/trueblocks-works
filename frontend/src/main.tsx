import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { BrowserRouter } from 'react-router-dom';
import { theme } from '@/theme';
import { TabProvider } from '@/stores';
import App from './App';

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <MantineProvider theme={theme} defaultColorScheme="light">
    <Notifications position="top-right" />
    <BrowserRouter>
      <TabProvider>
        <App />
      </TabProvider>
    </BrowserRouter>
  </MantineProvider>
);
