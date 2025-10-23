import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script - Exposes safe API to renderer process
 *
 * This runs in a sandboxed context with access to Node.js APIs
 * but exposes only specific functionality to the renderer.
 */

// Expose APIs to renderer
contextBridge.exposeInMainWorld('electron', {
  // Platform information
  platform: process.platform,

  // Database operations (will be implemented via IPC)
  db: {
    saveFieldEntry: (data: unknown) => ipcRenderer.invoke('db:saveFieldEntry', data),
    getFieldEntries: (wellId: string) => ipcRenderer.invoke('db:getFieldEntries', wellId),
    getSyncQueue: () => ipcRenderer.invoke('db:getSyncQueue'),
  },

  // Sync operations
  sync: {
    start: () => ipcRenderer.invoke('sync:start'),
    getStatus: () => ipcRenderer.invoke('sync:getStatus'),
  },

  // File operations (for photos)
  files: {
    selectPhoto: () => ipcRenderer.invoke('files:selectPhoto'),
    savePhoto: (data: string) => ipcRenderer.invoke('files:savePhoto', data),
  },
});

// Type definitions for renderer
declare global {
  interface Window {
    electron: {
      platform: string;
      db: {
        saveFieldEntry: (data: unknown) => Promise<void>;
        getFieldEntries: (wellId: string) => Promise<unknown[]>;
        getSyncQueue: () => Promise<unknown[]>;
      };
      sync: {
        start: () => Promise<void>;
        getStatus: () => Promise<unknown>;
      };
      files: {
        selectPhoto: () => Promise<string | null>;
        savePhoto: (data: string) => Promise<string>;
      };
    };
  }
}
