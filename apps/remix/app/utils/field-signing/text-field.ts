import { FieldType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldText } from '@documenso/lib/types/field';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';

import { SignFieldTextDialog } from '~/components/dialogs/sign-field-text-dialog';

type HandleTextFieldClickOptions = {
  field: TFieldText;
  text: string | null;
};

export const handleTextFieldClick = async (
  options: HandleTextFieldClickOptions,
): Promise<Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.TEXT }> | null> => {
  const { field, text } = options;

  if (field.type !== FieldType.TEXT) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  // If field is already inserted, allow editing by opening the dialog with current value
  const currentValue = field.inserted && field.customText ? field.customText : text;

  const textToInsert = await SignFieldTextDialog.call({
    fieldMeta: field.fieldMeta,
    currentValue: currentValue || undefined,
  });

  if (!textToInsert) {
    // If user cancels and field was already inserted, return null to keep current value
    if (field.inserted) {
      return null;
    }
    return null;
  }

  return {
    type: FieldType.TEXT,
    value: textToInsert,
  };
};
