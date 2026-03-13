import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { PlusIcon, Trash } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import {
  DEFAULT_FIELD_FONT_SIZE,
  type TFlexibleRadioFieldMeta as FlexibleRadioFieldMeta,
  ZFlexibleRadioFieldMeta,
} from '@documenso/lib/types/field-meta';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Separator } from '@documenso/ui/primitives/separator';

import {
  EditorGenericFontSizeField,
  EditorGenericReadOnlyField,
  EditorGenericRequiredField,
} from './editor-field-generic-field-forms';

const ZFlexibleRadioFieldFormSchema = ZFlexibleRadioFieldMeta.pick({
  label: true,
  groupName: true,
  items: true,
  required: true,
  readOnly: true,
  fontSize: true,
});

type TFlexibleRadioFieldFormSchema = z.infer<typeof ZFlexibleRadioFieldFormSchema>;

export type EditorFieldFlexibleRadioFormProps = {
  value: FlexibleRadioFieldMeta | undefined;
  onValueChange: (value: FlexibleRadioFieldMeta) => void;
};

export const EditorFieldFlexibleRadioForm = ({
  value = {
    type: 'flexible-radio',
    items: [],
  },
  onValueChange,
}: EditorFieldFlexibleRadioFormProps) => {
  const { t } = useLingui();

  const form = useForm<TFlexibleRadioFieldFormSchema>({
    resolver: zodResolver(ZFlexibleRadioFieldFormSchema),
    mode: 'onChange',
    defaultValues: {
      label: value.label || '',
      groupName: value.groupName || '',
      items: value.items || [],
      required: value.required || false,
      readOnly: value.readOnly || false,
      fontSize: value.fontSize || DEFAULT_FIELD_FONT_SIZE,
    },
  });

  const formValues = useWatch({
    control: form.control,
  });

  const addItem = () => {
    const currentItems = form.getValues('items') || [];
    const newId =
      currentItems.length > 0 ? Math.max(...currentItems.map((item) => item.id)) + 1 : 1;

    // Calculate position for new item to avoid overlap
    // Stack items vertically with 5px spacing
    const lastItem = currentItems[currentItems.length - 1];
    const newPositionY = lastItem ? lastItem.positionY + lastItem.height + 5 : 0;

    const newItems = [
      ...currentItems,
      {
        id: newId,
        checked: false,
        value: '',
        positionX: 0,
        positionY: newPositionY,
        width: 20,
        height: 20,
      },
    ];
    form.setValue('items', newItems);
  };

  const removeItem = (index: number) => {
    const currentItems = form.getValues('items') || [];

    if (currentItems.length === 1) {
      return;
    }

    const newItems = [...currentItems];
    newItems.splice(index, 1);

    form.setValue('items', newItems);
  };

  useEffect(() => {
    const validatedFormValues = ZFlexibleRadioFieldFormSchema.safeParse(formValues);

    if (validatedFormValues.success) {
      onValueChange({
        type: 'flexible-radio',
        ...validatedFormValues.data,
      });
    }
  }, [formValues, onValueChange]);

  return (
    <Form {...form}>
      <form>
        <fieldset className="flex flex-col gap-2">
          <EditorGenericFontSizeField formControl={form.control} />

          <FormField
            control={form.control}
            name="groupName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Group Name (Optional)</Trans>
                </FormLabel>
                <FormControl>
                  <Input
                    data-testid="field-form-group-name"
                    placeholder={t`Enter group name`}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <EditorGenericRequiredField formControl={form.control} />

          <EditorGenericReadOnlyField formControl={form.control} />

          <section className="space-y-2">
            <div className="-mx-4 mb-4 mt-2">
              <Separator />
            </div>

            <div className="flex flex-row items-center justify-between gap-2">
              <p className="text-sm font-medium">
                <Trans>Radio items</Trans>
              </p>

              <button type="button" data-testid="field-form-items-add" onClick={addItem}>
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              <Trans>Position and size each radio button on the canvas after adding items.</Trans>
            </p>

            <ul className="space-y-4">
              {(formValues.items || []).map((item, index) => (
                <li
                  key={`radio-item-${index}`}
                  className="space-y-2 rounded-md border border-border p-3"
                >
                  <div className="flex flex-row items-center gap-2">
                    <FormField
                      control={form.control}
                      name={`items.${index}.checked`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Checkbox
                              data-testid={`field-form-items-${index}-checked`}
                              className="h-5 w-5 border-foreground/30 data-[state=checked]:bg-primary"
                              checked={field.value}
                              onCheckedChange={(value) => {
                                // Uncheck all other items.
                                const currentItems = form.getValues('items') || [];

                                if (value) {
                                  const newItems = currentItems.map((itm) => ({
                                    ...itm,
                                    checked: false,
                                  }));

                                  form.setValue('items', newItems);
                                }

                                field.onChange(value);
                              }}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.value`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input
                              data-testid={`field-form-items-${index}-value`}
                              className="w-full"
                              placeholder={t`Value`}
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <button
                      type="button"
                      data-testid={`field-form-items-${index}-remove`}
                      className="flex h-10 w-10 items-center justify-center text-slate-500 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => removeItem(index)}
                    >
                      <Trash className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name={`items.${index}.positionX`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">
                            <Trans>X Position</Trans>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              data-testid={`field-form-items-${index}-positionX`}
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.positionY`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">
                            <Trans>Y Position</Trans>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              data-testid={`field-form-items-${index}-positionY`}
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.width`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">
                            <Trans>Width</Trans>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              data-testid={`field-form-items-${index}-width`}
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 20)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.height`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">
                            <Trans>Height</Trans>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              data-testid={`field-form-items-${index}-height`}
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 20)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </li>
              ))}
            </ul>

            {(formValues.items || []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                <Trans>No radio items yet. Click + to add one.</Trans>
              </p>
            )}
          </section>
        </fieldset>
      </form>
    </Form>
  );
};
