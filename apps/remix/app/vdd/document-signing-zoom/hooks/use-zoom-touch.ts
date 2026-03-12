import { useEffect, useRef } from 'react';

import { useZoom } from '../context/zoom-context';
import { ZOOM_LEVELS } from '../types';

/**
 * Hook to handle mobile pinch-to-zoom gestures
 * - Detects two-finger touch gestures
 * - Applies proportional zoom based on distance change
 * - Snaps to nearest predefined level on gesture end
 */
export const useZoomTouch = () => {
  const { setZoomLevel, zoomLevel } = useZoom();
  const gestureState = useRef({
    initialDistance: 0,
    initialZoom: 1.0,
    centerX: 0,
    centerY: 0,
  });

  useEffect(() => {
    const getDistance = (touch1: Touch, touch2: Touch): number => {
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const getCenter = (touch1: Touch, touch2: Touch) => ({
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    });

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;

      const target = e.target as HTMLElement;
      const pdfContent = target.closest('[data-pdf-content]');
      if (!pdfContent) return;

      const center = getCenter(e.touches[0], e.touches[1]);
      gestureState.current = {
        initialDistance: getDistance(e.touches[0], e.touches[1]),
        initialZoom: zoomLevel,
        centerX: center.x,
        centerY: center.y,
      };
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      if (gestureState.current.initialDistance === 0) return;

      const target = e.target as HTMLElement;
      const pdfContent = target.closest('[data-pdf-content]');
      if (!pdfContent) return;

      e.preventDefault();

      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / gestureState.current.initialDistance;
      const newZoom = gestureState.current.initialZoom * scale;

      // Clamp to valid range
      const clampedZoom = Math.max(0.5, Math.min(2.0, newZoom));
      setZoomLevel(clampedZoom);
    };

    const handleTouchEnd = () => {
      if (gestureState.current.initialDistance === 0) return;

      // Snap to nearest predefined level
      const nearest = ZOOM_LEVELS.reduce((prev, curr) =>
        Math.abs(curr - zoomLevel) < Math.abs(prev - zoomLevel) ? curr : prev,
      );

      setZoomLevel(nearest);

      // Reset gesture state
      gestureState.current.initialDistance = 0;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [zoomLevel, setZoomLevel]);
};
