import { bytesToHex } from '@noble/ciphers/utils';
import { DocumentDataType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { sha256 } from '../../universal/crypto';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { env } from '../../utils/env';
import { logFileAttachmentDownload } from '../envelope-attachment/log-file-attachment-audit';
import { checkAttachmentAccess } from './check-attachment-access';

export interface DownloadFileAttachmentOptions {
  attachmentId: string;
  userId?: number;
  recipientToken?: string;
  requestMetadata?: ApiRequestMetadata;
}

export interface DownloadFileAttachmentResult {
  data: Uint8Array;
  filename: string;
  contentType: string;
  hash: string;
  fileSize: number;
}

export async function downloadFileAttachment(
  options: DownloadFileAttachmentOptions,
): Promise<DownloadFileAttachmentResult> {
  const { attachmentId, userId, recipientToken, requestMetadata } = options;

  const hasAccess = await checkAttachmentAccess({ attachmentId, userId, recipientToken });

  if (!hasAccess) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to access this attachment',
    });
  }

  const attachment = await prisma.envelopeAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      envelope: { select: { id: true } },
    },
  });

  if (!attachment) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Attachment ${attachmentId} not found`,
    });
  }

  if (attachment.type !== 'file') {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'This attachment is not a file attachment',
    });
  }

  if (!attachment.contentType || !attachment.hash || attachment.fileSize === null) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Attachment is missing required file metadata',
    });
  }

  const NEXT_PUBLIC_UPLOAD_TRANSPORT = env('NEXT_PUBLIC_UPLOAD_TRANSPORT');
  const storageType =
    NEXT_PUBLIC_UPLOAD_TRANSPORT === 's3' ? DocumentDataType.S3_PATH : DocumentDataType.BYTES_64;

  let fileData: Uint8Array;
  try {
    fileData = await getFileServerSide({ type: storageType, data: attachment.data });
  } catch (error) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Failed to retrieve file from storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  const computedHash = bytesToHex(sha256(fileData));

  if (computedHash !== attachment.hash) {
    console.error(
      `Hash verification failed for attachment ${attachmentId}. Expected: ${attachment.hash}, Got: ${computedHash}`,
    );
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'File integrity verification failed. The file may have been corrupted.',
    });
  }

  try {
    await logFileAttachmentDownload({
      attachmentId: attachment.id,
      filename: attachment.label,
      userId: userId ?? null,
      envelopeId: attachment.envelope.id,
      metadata: requestMetadata,
    });
  } catch (error) {
    console.error('Failed to create audit log for file attachment download:', error);
  }

  return {
    data: fileData,
    filename: attachment.label,
    contentType: attachment.contentType,
    hash: attachment.hash,
    fileSize: attachment.fileSize,
  };
}
