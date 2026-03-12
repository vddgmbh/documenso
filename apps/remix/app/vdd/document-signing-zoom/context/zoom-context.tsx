import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';

import type { ZoomContextValue } from '../types';
import { ZOOM_LEVELS } from '../types';

const ZoomContext = createContext<ZoomContextValue | null>(null);

const STORAGE_KEY = 'documenso-zoom-level';

/**
 * Safe sessionStorage wrapper with error handling
 * Only works on client-side (returns null on server)
 */
const safeSessionStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return sessionStorage.getItem(key);
    } catch (error) {
      console.warn('SessionStorage read failed:', error);
      return null;
    }
  },

  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(key, value);
    } catch (error) {
      console.warn('SessionStorage write failed:', error);
    }
  },

  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.warn('SessionStorage remove failed:', error);
    }
  },
};

export type ZoomProviderProps = {
  children: ReactNode;
};

export const ZoomProvider = ({ children }: ZoomProviderProps) => {
  // Always start with default value for SSR consistency
  const [zoomLevel, setZoomLevelState] = useState<number>(1.0);

  // Load from sessionStorage only on client-side after mount
  useEffect(() => {
    const stored = safeSessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2.5) {
        setZoomLevelState(parsed);
      }
    }
  }, []);

  const setZoomLevel = useCallback((level: number) => {
    // Validate input
    if (typeof level !== 'number' || isNaN(level) || !isFinite(level)) {
      console.error('Invalid zoom level:', level);
      return;
    }

    // Clamp to valid range [0.5, 2.5]
    const clamped = Math.max(0.5, Math.min(2.5, level));

    if (clamped !== level) {
      console.warn(`Zoom level ${level} clamped to ${clamped}`);
    }

    setZoomLevelState(clamped);
    safeSessionStorage.setItem(STORAGE_KEY, clamped.toString());
  }, []);

  const zoomIn = useCallback(() => {
    const currentIndex = ZOOM_LEVELS.findIndex((level) => level >= zoomLevel);
    if (currentIndex !== -1 && currentIndex < ZOOM_LEVELS.length - 1) {
      setZoomLevel(ZOOM_LEVELS[currentIndex + 1]);
    }
  }, [zoomLevel, setZoomLevel]);

  const zoomOut = useCallback(() => {
    const currentIndex = ZOOM_LEVELS.findIndex((level) => level >= zoomLevel);
    if (currentIndex > 0) {
      setZoomLevel(ZOOM_LEVELS[currentIndex - 1]);
    }
  }, [zoomLevel, setZoomLevel]);

  const resetZoom = useCallback(() => {
    setZoomLevel(1.0);
  }, [setZoomLevel]);

  const canZoomIn = zoomLevel < 2.5;
  const canZoomOut = zoomLevel > 0.5;

  return (
    <ZoomContext.Provider
      value={{ zoomLevel, zoomIn, zoomOut, resetZoom, setZoomLevel, canZoomIn, canZoomOut }}
    >
      {children}
    </ZoomContext.Provider>
  );
};

export const useZoom = (): ZoomContextValue => {
  const context = useContext(ZoomContext);
  if (!context) {
    throw new Error('useZoom must be used within ZoomProvider');
  }
  return context;
};

/**
 * Clear zoom level from sessionStorage (call on signing completion)
 */
export const clearZoomStorage = (): void => {
  safeSessionStorage.removeItem(STORAGE_KEY);
};
