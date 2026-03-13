import Konva from 'konva';
import { match } from 'ts-pattern';

import { DEFAULT_STANDARD_FONT_SIZE } from '../../constants/pdf';
import type { TFlexibleRadioFieldMeta } from '../../types/field-meta';
import { getSelectedRadioItemIndex } from '../../utils/flexible-radio';
import {
  createFieldHoverInteraction,
  upsertFieldGroup,
  upsertFieldRect,
} from './field-generic-items';
import { calculateFieldPosition } from './field-renderer';
import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';

const calculateRadioSize = (fontSize: number) => {
  return fontSize;
};

export const renderFlexibleRadioFieldElement = (
  field: FieldToRender,
  options: RenderFieldElementOptions,
) => {
  const { pageWidth, pageHeight, pageLayer, mode, color, scale } = options;

  const flexibleRadioMeta: TFlexibleRadioFieldMeta | null =
    (field.fieldMeta as TFlexibleRadioFieldMeta | undefined) || null;
  const radioItems = flexibleRadioMeta?.items || [];

  const isFirstRender = !pageLayer.findOne(`#${field.renderId}`);

  // Clear previous children and listeners to re-render fresh
  const fieldGroup = upsertFieldGroup(field, options);
  fieldGroup.removeChildren();
  fieldGroup.off('transform');

  if (isFirstRender) {
    pageLayer.add(fieldGroup);
  }

  // Create parent bounding box (invisible, for compatibility)
  const fieldRect = upsertFieldRect(field, options);
  fieldGroup.add(fieldRect);

  const fontSize = flexibleRadioMeta?.fontSize || DEFAULT_STANDARD_FONT_SIZE;
  const selectedIndex = getSelectedRadioItemIndex(field);

  const { fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);

  radioItems.forEach((item, index) => {
    const isRadioItemChecked = match(mode)
      .with('edit', () => item.checked)
      .with('sign', () => index === selectedIndex)
      .with('export', () => {
        // If it's read-only, check the originally checked state.
        if (flexibleRadioMeta?.readOnly) {
          return item.checked;
        }

        return index === selectedIndex;
      })
      .exhaustive();

    // Create clickable area (transparent rectangle)
    const clickArea = new Konva.Rect({
      internalRadioIndex: index,
      id: `radio-clickarea-${index}`,
      name: 'radio-clickarea',
      x: item.positionX,
      y: item.positionY,
      width: item.width,
      height: item.height,
      fill: 'transparent',
      stroke: mode === 'edit' ? '#3b82f6' : 'transparent',
      strokeWidth: mode === 'edit' ? 1 : 0,
    });

    // Calculate circle position (centered in clickable area)
    const circleX = item.positionX + item.width / 2;
    const circleY = item.positionY + item.height / 2;
    const circleRadius = calculateRadioSize(fontSize) / 2;

    // Circle which represents the radio button
    const circle = new Konva.Circle({
      internalRadioIndex: index,
      id: `radio-circle-${index}`,
      name: 'radio-circle',
      x: circleX,
      y: circleY,
      radius: circleRadius,
      stroke: '#374151',
      strokeWidth: 1.5,
      fill: 'white',
    });

    // Dot which represents the selected state
    const dot = new Konva.Circle({
      internalRadioIndex: index,
      id: `radio-dot-${index}`,
      name: 'radio-dot',
      x: circleX,
      y: circleY,
      radius: circleRadius / 2,
      fill: '#111827',
      visible: isRadioItemChecked,
    });

    fieldGroup.add(clickArea);
    fieldGroup.add(circle);
    fieldGroup.add(dot);
  });

  // Handle rescaling items during transforms
  fieldGroup.on('transform', () => {
    const groupScaleX = fieldGroup.scaleX();
    const groupScaleY = fieldGroup.scaleY();

    const fieldRect = fieldGroup.findOne('.field-rect');

    if (!fieldRect) {
      return;
    }

    const rectWidth = fieldRect.width() * groupScaleX;
    const rectHeight = fieldRect.height() * groupScaleY;

    const clickAreas = fieldGroup
      .find('.radio-clickarea')
      .sort((a, b) => a.id().localeCompare(b.id(), undefined, { numeric: true }));
    const circles = fieldGroup
      .find('.radio-circle')
      .sort((a, b) => a.id().localeCompare(b.id(), undefined, { numeric: true }));
    const dots = fieldGroup
      .find('.radio-dot')
      .sort((a, b) => a.id().localeCompare(b.id(), undefined, { numeric: true }));

    const groupedItems = clickAreas.map((clickArea, i) => ({
      clickAreaElement: clickArea,
      circleElement: circles[i],
      dotElement: dots[i],
    }));

    groupedItems.forEach((itemElements, i) => {
      const { clickAreaElement, circleElement, dotElement } = itemElements;
      const item = radioItems[i];

      if (!item) return;

      // Scale positions and dimensions
      const scaledX = item.positionX;
      const scaledY = item.positionY;
      const scaledWidth = item.width;
      const scaledHeight = item.height;

      clickAreaElement.setAttrs({
        x: scaledX,
        y: scaledY,
        width: scaledWidth,
        height: scaledHeight,
        scaleX: 1,
        scaleY: 1,
      });

      const circleX = scaledX + scaledWidth / 2;
      const circleY = scaledY + scaledHeight / 2;

      circleElement.setAttrs({
        x: circleX,
        y: circleY,
        scaleX: 1,
        scaleY: 1,
      });

      dotElement.setAttrs({
        x: circleX,
        y: circleY,
        scaleX: 1,
        scaleY: 1,
      });
    });

    fieldRect.setAttrs({
      width: rectWidth,
      height: rectHeight,
    });

    fieldGroup.scale({
      x: 1,
      y: 1,
    });

    pageLayer.batchDraw();
  });

  if (color !== 'readOnly' && mode !== 'export') {
    createFieldHoverInteraction({ fieldGroup, fieldRect, options });
  }

  return {
    fieldGroup,
    isFirstRender,
  };
};
