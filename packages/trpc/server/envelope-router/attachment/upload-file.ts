import { uploadFileAttachment } from '@documenso/lib/server-only/attachment/upload-file-attachment';

import { authenticatedProcedure } from '../../trpc';
import {
  ZUploadFileAttachmentRequestSchema,
  ZUploadFileAttachmentResponseSchema,
} from './upload-file.types';

export const uploadFileRoute = authenticatedProcedure
  .input(ZUploadFileAttachmentRequestSchema)
  .output(ZUploadFileAttachmentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user.id;

    const fileBuffer = Buffer.from(input.fileBase64, 'base64');
    const file = new File([fileBuffer], input.fileName, {
      type: input.fileType,
    });

    ctx.logger.info({
      input: { envelopeId: input.envelopeId, filename: file.name, fileSize: file.size },
    });

    const result = await uploadFileAttachment({
      file,
      envelopeId: input.envelopeId,
      userId,
      requestMetadata: ctx.metadata,
    });

    return {
      id: result.id,
      hash: result.hash,
      fileSize: result.fileSize,
      contentType: result.contentType,
    };
  });
