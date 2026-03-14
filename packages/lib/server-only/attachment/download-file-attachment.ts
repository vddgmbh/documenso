import { DocumentDataType } from '@prisma/client';
import { bytesToHex } from '@noble/ciphers/utils';

import { prisma } from '@documenso/prisma';

import { AppError } from '../../errors/app-error';
import { sha256 } from '../../universal/crypto';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { env } from '../../utils/env';
import { logFileAttachmentDownload } from '../envelope-attachment/log-file-attachment-audit';
import { checkAttachmentAccess } from './check-attachment-access';

/**
 * Options for downloading a file attachment
 */
export interface DownloadFileAttachmentOptions {
  /**
   * The ID of the attachment to download
   */
  attachmentId: string;

  /**
   * The ID of the user requesting the download (optional)
   */
  userId?: number;

  /**
   * The recipient token for token-based access (optional)
   */
  recipientToken?: string;

  /**
   * Request metadata for audit logging
   */
  requestMetadata?: RequestMetadata;
}

/**
 * Result of downloading a file attachment
 */
export interface DownloadFileAttachmentResult {
  /**
   * The file data as a Uint8Array
   */
  data: Uint8Array;

  /**
   * The filename
   */
  filename: string;

  /**
   * The content type (MIME type)
   */
  contentType: string;

  /**
   * The SHA-256 hash of the file
   */
  hash: string;

  /**
   * The file size in bytes
   */
  fileSize: number;
}

/**
 * Download a file attachment with access control and integrity verification
 * 
 * This function orchestrates the complete file download process:
 * 1. Checks access permissions using checkAttachmentAccess
 * 2. Retrieves the file from storage
 * 3. Verifies the hash matches the stored hash (Property 19)
 * 4. Logs the download to the audit log
 * 5. Returns the file data with metadata
 * 
 * @param options - Download options including attachment ID and authentication
 * @returns Download result with file data and metadata
 * @throws AppError if access denied, attachment not found, or hash verification fails
 */
export async function downloadFileAttachment(
  options: DownloadFileAttachmentOptions,
): Promise<DownloadFileAttachmentResult> {
  const { attachmentId, userId, recipientToken, requestMetadata } = options;

  // 1. Check access permissions
  const hasAccess = await checkAttachmentAccess({
    attachmentId,
    userId,
    recipientToken,
  });

  if (!hasAccess) {
    throw new AppError('ACCESS_DENIED', 'You do not have permission to access this attachment');
  }

  // 2. Fetch the attachment with envelope information
  const attachment = await prisma.envelopeAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      envelope: {
        select: {
          id: true,
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

  // Verify required file metadata exists
  if (!attachment.contentType || !attachment.hash || attachment.fileSize === null) {
    throw new AppError(
      'INVALID_ATTACHMENT_DATA',
      'Attachment is missing required file metadata',
    );
  }

  // 3. Determine storage type from environment
  const NEXT_PUBLIC_UPLOAD_TRANSPORT = env('NEXT_PUBLIC_UPLOAD_TRANSPORT');
  const storageType =
    NEXT_PUBLIC_UPLOAD_TRANSPORT === 's3' ? DocumentDataType.S3_PATH : DocumentDataType.BYTES_64;

  // 4. Retrieve file from storage
  let fileData: Uint8Array;
  try {
    fileData = await getFileServerSide({
      type: storageType,
      data: attachment.data,
    });
  } catch (error) {
    throw new AppError(
      'FILE_NOT_FOUND_IN_STORAGE',
      `Failed to retrieve file from storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  // 5. Verify hash matches stored hash (Property 19)
  const computedHashBytes = sha256(fileData);
  const computedHash = bytesToHex(computedHashBytes);

  if (computedHash !== attachment.hash) {
    // Log critical error
    console.error(
      `Hash verification failed for attachment ${attachmentId}. Expected: ${attachment.hash}, Got: ${computedHash}`,
    );

    throw new AppError(
      'HASH_VERIFICATION_FAILED',
      'File integrity verification failed. The file may have been corrupted.',
    );
  }

  // 6. Log download to audit log
  try {
    await logFileAttachmentDownload({
      attachmentId: attachment.id,
      filename: attachment.label,
      userId: userId ?? null,
      envelopeId: attachment.envelope.id,
      metadata: requestMetadata,
    });
  } catch (error) {
    // Audit log failure should not prevent the download
    console.error('Failed to create audit log for file attachment download:', error);
  }

  // 7. Return file data with metadata
  return {
    data: fileData,
    filename: attachment.label,
    contentType: attachment.contentType,
    hash: attachment.hash,
    fileSize: attachment.fileSize,
  };
}
