import type { Field } from '@prisma/client';

import type { TFlexibleRadioFieldMeta, TFlexibleRadioItem } from '../types/field-meta';
import { ZFlexibleRadioFieldMeta } from '../types/field-meta';

/**
 * Validates flexible radio field metadata using Zod schema.
 * Ensures at most one item has checked: true and validates all positions and dimensions.
 */
export function validateFlexibleRadioFieldMeta(meta: unknown): TFlexibleRadioFieldMeta {
  return ZFlexibleRadioFieldMeta.parse(meta);
}

/**
 * Calculates the bounding box that encompasses all radio items.
 * Returns the minimum X/Y coordinates and the maximum extent for width/height.
 */
export function calculateFlexibleRadioGroupBounds(items: TFlexibleRadioItem[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (items.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const item of items) {
    minX = Math.min(minX, item.positionX);
    minY = Math.min(minY, item.positionY);
    maxX = Math.max(maxX, item.positionX + item.width);
    maxY = Math.max(maxY, item.positionY + item.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Gets the selected radio item index from a field's customText.
 * Returns null if no selection or invalid index.
 */
export function getSelectedRadioItemIndex(
  field: Pick<Field, 'customText' | 'type'>,
): number | null {
  if (!field.customText || field.customText === '') {
    return null;
  }

  const index = parseInt(field.customText, 10);

  if (isNaN(index) || index < 0) {
    return null;
  }

  return index;
}
