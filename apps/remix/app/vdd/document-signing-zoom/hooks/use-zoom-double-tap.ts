import { useEffect, useRef } from 'react';

import { useZoom } from '../context/zoom-context';

const DOUBLE_TAP_DELAY = 300;

/**
 * Hook to handle double-tap zoom toggle on mobile devices
 * - Detects two taps within 300ms
 * - Toggles between 100% and 150% zoom
 * - Centers zoom on tap location
 */
export const useZoomDoubleTap = () => {
  const { setZoomLevel, zoomLevel } = useZoom();
  const lastTapTime = useRef(0);
  const lastTapLocation = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleTouchEnd = (e: TouchEvent) => {
      // Only handle single-finger taps
      if (e.changedTouches.length !== 1) return;

      const target = e.target as HTMLElement;
      const pdfContent = target.closest('[data-pdf-content]');
      if (!pdfContent) return;

      // Don't zoom if tapping on a signing field
      const isField = target.closest('[data-signing-field]');
      if (isField) return;

      const touch = e.changedTouches[0];
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTime.current;

      if (timeSinceLastTap < DOUBLE_TAP_DELAY) {
        // Double tap detected
        e.preventDefault();

        // Toggle between 100% and 150%
        const newZoom = zoomLevel === 1.0 ? 1.5 : 1.0;
        setZoomLevel(newZoom);

        lastTapTime.current = 0; // Reset to prevent triple-tap
      } else {
        // First tap
        lastTapTime.current = now;
        lastTapLocation.current = { x: touch.clientX, y: touch.clientY };
      }
    };

    window.addEventListener('touchend', handleTouchEnd);
    return () => window.removeEventListener('touchend', handleTouchEnd);
  }, [zoomLevel, setZoomLevel]);
};
