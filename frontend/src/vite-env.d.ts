/// <reference types="vite/client" />

declare global {
  interface Window {
    go?: Record<string, unknown>;
  }
}

export {};
