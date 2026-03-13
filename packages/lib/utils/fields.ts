import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { type Envelope, type Field, FieldType } from '@prisma/client';

import { PDF_VIEWER_CONTENT_SELECTOR } from '@documenso/lib/constants/pdf-viewer';

import { extractLegacyIds } from '../universal/id';

/**
 * Sort the fields by the Y position on the document.
 */
export const sortFieldsByPosition = (fields: Field[]): Field[] => {
  const clonedFields: Field[] = JSON.parse(JSON.stringify(fields));

  // Sort by page first, then position on page second.
  return clonedFields.sort((a, b) => a.page - b.page || Number(a.positionY) - Number(b.positionY));
};

/**
 * Validate whether all the provided fields are inserted.
 *
 * If there are any non-inserted fields it will be highlighted and scrolled into view.
 *
 * @returns `true` if all fields are inserted, `false` otherwise.
 */
export const validateFieldsInserted = (fields: Field[]): boolean => {
  const fieldCardElements = document.getElementsByClassName('field-card-container');
  const pdfContent = document.querySelector(PDF_VIEWER_CONTENT_SELECTOR);

  const uninsertedFields = sortFieldsByPosition(fields.filter((field) => !field.inserted));

  // All fields are inserted — clear the validation signal.
  if (uninsertedFields.length === 0) {
    pdfContent?.removeAttribute('data-validate-fields');
    return true;
  }

  // Attach validate attribute on all fields currently in the DOM.
  Array.from(fieldCardElements).forEach((element) => {
    element.setAttribute('data-validate', 'true');
  });

  // Also set a signal on the PDF viewer container so that field elements that
  // mount later (e.g. after the virtual list scrolls to a new page) can pick
  // up the validation state.
  pdfContent?.setAttribute('data-validate-fields', 'true');

  const firstUninsertedField = uninsertedFields[0];

  if (firstUninsertedField) {
    // Try direct element scroll first (works if the field's page is currently rendered).
    const firstUninsertedFieldElement = document.getElementById(`field-${firstUninsertedField.id}`);

    if (firstUninsertedFieldElement) {
      // Check if the field is visible in the viewport
      const rect = firstUninsertedFieldElement.getBoundingClientRect();
      const isVisible =
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth);

      if (!isVisible) {
        // Field exists but not visible - scroll to the page first
        if (pdfContent) {
          pdfContent.setAttribute('data-scroll-to-page', String(firstUninsertedField.page));
        }
      }

      // Always scroll to field (either immediately if visible, or after page scroll)
      setTimeout(
        () => {
          firstUninsertedFieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },
        isVisible ? 0 : 300,
      );
    } else {
      // Field not in DOM (page virtualized away) — jump to the page directly
      const pdfContent = document.querySelector('[data-pdf-content][data-page-count]');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (pdfContent && (pdfContent as any).__scrollToItem) {
        // Call scrollToItem directly (pages are 1-indexed, items are 0-indexed)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pdfContent as any).__scrollToItem(firstUninsertedField.page - 1, 'auto');

        // After jumping to the page, wait for render then scroll to field
        setTimeout(() => {
          const firstUninsertedFieldElement = document.getElementById(
            `field-${firstUninsertedField.id}`,
          );

          if (firstUninsertedFieldElement) {
            firstUninsertedFieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 200);
      } else {
        // Fallback to attribute method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fallbackEl = (pdfContent ||
          document.querySelector(PDF_VIEWER_CONTENT_SELECTOR)) as any;
        if (fallbackEl) {
          fallbackEl.setAttribute('data-scroll-to-page', String(firstUninsertedField.page));
        }
      }
    }
  }

  return false;
};

export const validateFieldsUninserted = (): boolean => {
  const fieldCardElements = document.getElementsByClassName('react-draggable');

  const errorElements: HTMLElement[] = [];

  Array.from(fieldCardElements).forEach((element) => {
    const innerDiv = element.querySelector('div');
    const hasError = innerDiv?.getAttribute('data-error') === 'true';

    if (hasError) {
      errorElements.push(element as HTMLElement);
    } else {
      element.removeAttribute('data-error');
    }
  });

  if (errorElements.length > 0) {
    errorElements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }

  return errorElements.length === 0;
};

export const mapFieldToLegacyField = (
  field: Field,
  envelope: Pick<Envelope, 'type' | 'secondaryId'>,
) => {
  const legacyId = extractLegacyIds(envelope);

  return {
    ...field,
    ...legacyId,
  };
};

export const parseCheckboxCustomText = (customText: string): number[] => {
  if (!customText) {
    return [];
  }

  return JSON.parse(customText);
};

export const toCheckboxCustomText = (checkedValues: number[]): string => {
  return JSON.stringify(checkedValues);
};

export const parseRadioCustomText = (customText: string): number => {
  return Number(customText);
};

export const toRadioCustomText = (value: number): string => {
  return value.toString();
};

export const getClientSideFieldTranslations = ({ t }: I18n): Record<FieldType, string> => {
  return {
    [FieldType.TEXT]: t(msg`Text`),
    [FieldType.CHECKBOX]: t(msg`Checkbox`),
    [FieldType.RADIO]: t(msg`Radio`),
    [FieldType.FLEXIBLE_RADIO]: t(msg`Flexible Radio`),
    [FieldType.DROPDOWN]: t(msg`Select Option`),
    [FieldType.SIGNATURE]: t(msg`Signature`),
    [FieldType.FREE_SIGNATURE]: t(msg`Free Signature`),
    [FieldType.INITIALS]: t(msg`Initials`),
    [FieldType.NAME]: t(msg`Name`),
    [FieldType.NUMBER]: t(msg`Number`),
    [FieldType.DATE]: t(msg`Date`),
    [FieldType.EMAIL]: t(msg`Email`),
  };
};
