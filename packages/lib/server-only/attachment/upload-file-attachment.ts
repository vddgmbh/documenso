import { bytesToHex } from '@noble/ciphers/utils';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { sha256 } from '../../universal/crypto';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { putFileServerSide } from '../../universal/upload/put-file.server';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { validateFileAttachment } from '../../utils/file-attachment-validation';

export interface UploadFileAttachmentOptions {
  file: File;
  envelopeId: string;
  userId: number;
  requestMetadata?: ApiRequestMetadata;
}

export interface UploadFileAttachmentResult {
  id: string;
  storageKey: string;
  hash: string;
  fileSize: number;
  contentType: string;
}

export async function uploadFileAttachment(
  options: UploadFileAttachmentOptions,
): Promise<UploadFileAttachmentResult> {
  const { file, envelopeId, userId, requestMetadata } = options;

  const validation = validateFileAttachment(file);
  if (!validation.valid) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: validation.error,
    });
  }

  const envelope = await prisma.envelope.findUnique({
    where: { id: envelopeId },
    select: { id: true },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Envelope ${envelopeId} not found`,
    });
  }

  const arrayBuffer = await file.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);
  const hash = bytesToHex(sha256(fileBytes));

  let storageResult;
  try {
    storageResult = await putFileServerSide(file);
  } catch (error) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: `Failed to store file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  let attachment;
  try {
    attachment = await prisma.envelopeAttachment.create({
      data: {
        type: 'file',
        label: file.name,
        data: storageResult.data,
        fileSize: file.size,
        contentType: file.type,
        hash,
        envelopeId,
      },
    });
  } catch (error) {
    console.error('Database error creating attachment:', error);
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: `Failed to create attachment record: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
    });
  }

  try {
    await prisma.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_UPLOADED,
        envelopeId,
        user: { id: userId },
        metadata: requestMetadata,
        data: {
          attachmentId: attachment.id,
          filename: file.name,
          fileSize: file.size,
          contentType: file.type,
          hash,
        },
      }),
    });
  } catch (error) {
    console.error('Failed to create audit log for file attachment upload:', error);
  }

  return {
    id: attachment.id,
    storageKey: storageResult.data,
    hash,
    fileSize: file.size,
    contentType: file.type,
  };
}
