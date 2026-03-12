/**
 * Type definitions for document signing zoom functionality
 */

export const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5] as const;

export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

export type ZoomContextValue = {
  zoomLevel: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setZoomLevel: (level: number) => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
};

export type ZoomControlProps = {
  className?: string;
  variant?: 'desktop' | 'mobile';
};

export type UseZoomKeyboardProps = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
};

export type UseZoomWheelProps = {
  zoomIn: () => void;
  zoomOut: () => void;
};
