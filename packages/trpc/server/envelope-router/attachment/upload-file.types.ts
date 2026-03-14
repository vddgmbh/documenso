import { z } from 'zod';

export const ZUploadFileAttachmentRequestSchema = z.object({
  envelopeId: z.string().min(1),
  fileBase64: z.string().min(1),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
});

export const ZUploadFileAttachmentResponseSchema = z.object({
  id: z.string(),
  hash: z.string(),
  fileSize: z.number(),
  contentType: z.string(),
});

export type TUploadFileAttachmentRequest = z.infer<typeof ZUploadFileAttachmentRequestSchema>;
export type TUploadFileAttachmentResponse = z.infer<typeof ZUploadFileAttachmentResponseSchema>;
