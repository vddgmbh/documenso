/**
 * Document Signing Zoom Feature
 *
 * Provides zoom functionality for PDF documents during the signing process.
 * Supports multiple input methods: UI buttons, keyboard shortcuts, mouse wheel,
 * touchpad pinch, mobile pinch-to-zoom, and double-tap.
 */

export { ZoomProvider, useZoom, clearZoomStorage } from './context/zoom-context';
export { ZoomControl } from './components/zoom-control';
export { ZOOM_LEVELS } from './types';
export type { ZoomLevel, ZoomContextValue, ZoomControlProps } from './types';
