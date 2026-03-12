import { useEffect } from 'react';

import type { UseZoomKeyboardProps } from '../types';

/**
 * Hook to handle keyboard shortcuts for zoom control
 * - Ctrl/Cmd + Plus/Equals: Zoom in
 * - Ctrl/Cmd + Minus: Zoom out
 * - Ctrl/Cmd + 0: Reset to 100%
 */
export const useZoomKeyboard = ({ zoomIn, zoomOut, resetZoom }: UseZoomKeyboardProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifierKey = isMac ? e.metaKey : e.ctrlKey;

      if (!modifierKey) return;

      // Handle both main keyboard and numpad
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0' || e.code === 'Numpad0') {
        e.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, resetZoom]);
};
