import { createRoot } from 'react-dom/client';
import { Notifications } from '@mantine/notifications';
import { BrowserRouter } from 'react-router-dom';
import { TabProvider, ThemeProvider, DebugProvider } from '@/stores';
import App from './App';

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <ThemeProvider>
    <Notifications position="top-right" />
    <BrowserRouter>
      <TabProvider>
        <DebugProvider>
          <App />
        </DebugProvider>
      </TabProvider>
    </BrowserRouter>
  </ThemeProvider>
);
