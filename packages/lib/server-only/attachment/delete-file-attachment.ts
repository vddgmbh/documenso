import { DocumentDataType, DocumentStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError } from '../../errors/app-error';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { deleteFile } from '../../universal/upload/delete-file';
import { env } from '../../utils/env';
import { logFileAttachmentDelete } from '../envelope-attachment/log-file-attachment-audit';

/**
 * Options for deleting a file attachment
 */
export interface DeleteFileAttachmentOptions {
  /**
   * The ID of the attachment to delete
   */
  attachmentId: string;

  /**
   * The ID of the user requesting the deletion
   */
  userId: number;

  /**
   * Request metadata for audit logging
   */
  requestMetadata?: RequestMetadata;
}

/**
 * Delete a file attachment from a draft envelope
 * 
 * This function orchestrates the complete file deletion process:
 * 1. Verifies the attachment exists and is a file attachment
 * 2. Checks that the envelope is in DRAFT status
 * 3. Verifies the user is the envelope owner
 * 4. Deletes the file from storage
 * 5. Deletes the database record
 * 6. Logs the deletion to the audit log
 * 
 * @param options - Deletion options including attachment ID and user ID
 * @returns Promise that resolves when deletion is complete
 * @throws AppError if attachment not found, envelope not in draft, or user not authorized
 */
export async function deleteFileAttachment(
  options: DeleteFileAttachmentOptions,
): Promise<void> {
  const { attachmentId, userId, requestMetadata } = options;

  // 1. Fetch the attachment with envelope information
  const attachment = await prisma.envelopeAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      envelope: {
        select: {
          id: true,
          status: true,
          userId: true,
        },
      },
    },
  });

  if (!attachment) {
    throw new AppError('ATTACHMENT_NOT_FOUND', `Attachment ${attachmentId} not found`);
  }

  // Verify this is a file attachment, not a link
  if (attachment.type !== 'file') {
    throw new AppError('INVALID_ATTACHMENT_TYPE', 'This attachment is not a file attachment');
  }

  // 2. Check envelope status (must be DRAFT)
  if (attachment.envelope.status !== DocumentStatus.DRAFT) {
    throw new AppError(
      'ENVELOPE_ALREADY_SENT',
      'Cannot delete attachments from envelopes that have been sent',
    );
  }

  // 3. Check user is envelope owner
  if (attachment.envelope.userId !== userId) {
    throw new AppError(
      'UNAUTHORIZED',
      'Only the envelope owner can delete attachments',
    );
  }

  // 4. Delete file from storage
  const NEXT_PUBLIC_UPLOAD_TRANSPORT = env('NEXT_PUBLIC_UPLOAD_TRANSPORT');
  const storageType =
    NEXT_PUBLIC_UPLOAD_TRANSPORT === 's3' ? DocumentDataType.S3_PATH : DocumentDataType.BYTES_64;

  try {
    await deleteFile({
      type: storageType,
      data: attachment.data,
    });
  } catch (error) {
    // Log error but continue with database deletion
    // The file may already be deleted or the storage may be unavailable
    console.error(
      `Failed to delete file from storage for attachment ${attachmentId}:`,
      error,
    );
  }

  // 5. Delete database record
  try {
    await prisma.envelopeAttachment.delete({
      where: { id: attachmentId },
    });
  } catch (error) {
    throw new AppError(
      'DATABASE_ERROR',
      `Failed to delete attachment record: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  // 6. Log deletion to audit log
  try {
    await logFileAttachmentDelete({
      attachmentId: attachment.id,
      filename: attachment.label,
      userId,
      envelopeId: attachment.envelope.id,
      metadata: requestMetadata,
    });
  } catch (error) {
    // Audit log failure should not prevent the deletion from succeeding
    console.error('Failed to create audit log for file attachment deletion:', error);
  }
}
