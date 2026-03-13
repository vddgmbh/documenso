import { z } from 'zod';

export const ZEnvelopeAttachmentTypeSchema = z.enum(['link', 'file']);

export type TEnvelopeAttachmentType = z.infer<typeof ZEnvelopeAttachmentTypeSchema>;

// Validation schema for file attachment metadata
export const ZFileAttachmentMetadataSchema = z.object({
  fileSize: z.number().int().positive().max(10 * 1024 * 1024, 'File size must not exceed 10MB'),
  contentType: z.string().min(1, 'Content type is required'),
  hash: z.string().regex(/^[a-f0-9]{64}$/, 'Hash must be a valid SHA-256 hex string'),
});

export type TFileAttachmentMetadata = z.infer<typeof ZFileAttachmentMetadataSchema>;

// Validation schema for creating a file attachment
export const ZCreateFileAttachmentSchema = z.object({
  type: z.literal('file'),
  label: z.string().min(1, 'Label is required'),
  data: z.string().min(1, 'Storage key is required'),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024, 'File size must not exceed 10MB'),
  contentType: z.string().min(1, 'Content type is required'),
  hash: z.string().regex(/^[a-f0-9]{64}$/, 'Hash must be a valid SHA-256 hex string'),
});

export type TCreateFileAttachment = z.infer<typeof ZCreateFileAttachmentSchema>;

// Validation schema for creating a link attachment
export const ZCreateLinkAttachmentSchema = z.object({
  type: z.literal('link'),
  label: z.string().min(1, 'Label is required'),
  data: z.string().url('Must be a valid URL'),
});

export type TCreateLinkAttachment = z.infer<typeof ZCreateLinkAttachmentSchema>;

// Union schema for creating any attachment type
export const ZCreateAttachmentSchema = z.discriminatedUnion('type', [
  ZCreateFileAttachmentSchema,
  ZCreateLinkAttachmentSchema,
]);

export type TCreateAttachment = z.infer<typeof ZCreateAttachmentSchema>;
