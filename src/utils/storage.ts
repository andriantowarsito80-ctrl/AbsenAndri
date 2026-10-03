/**
 * Safe local storage utility to prevent crash in sandboxed/restricted iframe environments.
 */

// Simple in-memory fallback
const memoryStorage: Record<string, string> = {};

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn(`[SafeStorage] Access denied for getItem(${key}):`, e);
    }
    return memoryStorage[key] !== undefined ? memoryStorage[key] : null;
  },

  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn(`[SafeStorage] Access denied for setItem(${key}):`, e);
    }
    memoryStorage[key] = String(value);
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch (e) {
      console.warn(`[SafeStorage] Access denied for removeItem(${key}):`, e);
    }
    delete memoryStorage[key];
  },

  clear: (): void => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.clear();
        return;
      }
    } catch (e) {
      console.warn("[SafeStorage] Access denied for clear():", e);
    }
    for (const key in memoryStorage) {
      delete memoryStorage[key];
    }
  }
};
