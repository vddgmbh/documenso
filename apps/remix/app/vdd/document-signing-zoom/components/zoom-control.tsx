import { MinusIcon, PlusIcon, RotateCcwIcon } from 'lucide-react';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

import { useZoom } from '../context/zoom-context';
import { useZoomDoubleTap } from '../hooks/use-zoom-double-tap';
import { useZoomKeyboard } from '../hooks/use-zoom-keyboard';
import { useZoomTouch } from '../hooks/use-zoom-touch';
import { useZoomWheel } from '../hooks/use-zoom-wheel';
import type { ZoomControlProps } from '../types';

export const ZoomControl = ({ className, position = 'bottom-right' }: ZoomControlProps) => {
  const { zoomLevel, zoomIn, zoomOut, resetZoom, canZoomIn, canZoomOut } = useZoom();

  // Initialize input method handlers
  useZoomKeyboard({ zoomIn, zoomOut, resetZoom });
  useZoomWheel({ zoomIn, zoomOut });
  useZoomTouch();
  useZoomDoubleTap();

  const percentage = Math.round(zoomLevel * 100);

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  return (
    <div
      className={cn(
        'fixed z-50 flex items-center gap-2 rounded-lg border bg-background p-2 shadow-lg',
        positionClasses[position],
        className,
      )}
      role="toolbar"
      aria-label="Zoom controls"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={zoomOut}
        disabled={!canZoomOut}
        aria-label="Zoom out"
        aria-keyshortcuts="Control+Minus"
        className="h-10 min-h-[44px] w-10 min-w-[44px] p-0"
      >
        <MinusIcon className="h-4 w-4" />
      </Button>

      <span
        className="min-w-[4rem] text-center text-sm font-medium"
        aria-live="polite"
        aria-atomic="true"
      >
        {percentage}%
      </span>

      <Button
        variant="ghost"
        size="sm"
        onClick={zoomIn}
        disabled={!canZoomIn}
        aria-label="Zoom in"
        aria-keyshortcuts="Control+Plus"
        className="h-10 min-h-[44px] w-10 min-w-[44px] p-0"
      >
        <PlusIcon className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={resetZoom}
        aria-label="Reset zoom to 100 percent"
        aria-keyshortcuts="Control+0"
        className="h-10 min-h-[44px] w-10 min-w-[44px] p-0"
      >
        <RotateCcwIcon className="h-4 w-4" />
      </Button>

      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        Zoom level: {percentage} percent
      </div>
    </div>
  );
};
