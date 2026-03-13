import type { TFlexibleRadioFieldMeta as FlexibleRadioFieldMeta } from '../types/field-meta';

export const validateFlexibleRadioField = (
  value: string | undefined,
  fieldMeta: FlexibleRadioFieldMeta,
  isSigningFlow = false,
): string[] => {
  const errors: string[] = [];

  // If required and no value provided
  if (fieldMeta.required && !value) {
    errors.push('This field is required');
    return errors;
  }

  // If no value provided and not required, it's valid
  if (!value) {
    return errors;
  }

  // Parse the value as an index
  const selectedIndex = parseInt(value, 10);

  // Check if it's a valid number
  if (isNaN(selectedIndex)) {
    errors.push('Invalid selection');
    return errors;
  }

  // Check if the index is within valid range
  if (selectedIndex < 0 || selectedIndex >= fieldMeta.items.length) {
    errors.push('Invalid selection index');
    return errors;
  }

  return errors;
};
