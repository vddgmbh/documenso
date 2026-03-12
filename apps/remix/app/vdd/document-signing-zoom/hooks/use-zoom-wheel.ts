import { useEffect, useRef } from 'react';

import type { UseZoomWheelProps } from '../types';

const DEBOUNCE_MS = 100;

/**
 * Hook to handle mouse wheel zoom (Ctrl/Cmd + Wheel) and touchpad pinch gestures
 * - Mouse wheel with Ctrl/Cmd: Zoom in/out
 * - Touchpad pinch: Detected as wheel event with ctrlKey
 */
export const useZoomWheel = ({ zoomIn, zoomOut }: UseZoomWheelProps) => {
  const lastZoomTime = useRef(0);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Only handle if Ctrl/Cmd is pressed (mouse wheel zoom or touchpad pinch)
      if (!e.ctrlKey && !e.metaKey) return;

      // Check if we're over the PDF viewer
      const target = e.target as HTMLElement;
      const pdfContent = target.closest('[data-pdf-content]');
      if (!pdfContent) return;

      e.preventDefault();

      // Debounce to prevent excessive zoom changes
      const now = Date.now();
      if (now - lastZoomTime.current < DEBOUNCE_MS) return;
      lastZoomTime.current = now;

      // Negative deltaY = zoom in, positive = zoom out
      if (e.deltaY < 0) {
        zoomIn();
      } else if (e.deltaY > 0) {
        zoomOut();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [zoomIn, zoomOut]);
};
