import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

// Custom theme with FileMaker-inspired colors
const theme = createTheme({
  primaryColor: 'blue',
  colors: {
    // Status colors from FileMaker
    status: [
      '#E8F5E9', // Focus - light green
      '#C8E6C9', // Active - green
      '#BBDEFB', // Working - light blue
      '#E1BEE7', // Resting - light purple
      '#FFE0B2', // Waiting - light orange
      '#FFF9C4', // Gestating - light yellow
      '#F5F5F5', // Sleeping - light gray
      '#FFCDD2', // Dying - light red
      '#CFD8DC', // Dead - gray
      '#B3E5FC', // Out - cyan
    ],
    // Quality colors
    quality: [
      '#1B5E20', // Best - dark green
      '#388E3C', // Better - green
      '#66BB6A', // Good - light green
      '#9E9E9E', // Okay - gray
      '#F44336', // Bad - red
      '#9E9E9E', // Unknown - gray
      '#9E9E9E', '#9E9E9E', '#9E9E9E', '#9E9E9E',
    ],
  },
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MantineProvider>
  </React.StrictMode>,
);
