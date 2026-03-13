import { bytesToHex } from '@noble/ciphers/utils';

import { prisma } from '@documenso/prisma';

import { AppError } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { sha256 } from '../../universal/crypto';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { putFileServerSide } from '../../universal/upload/put-file.server';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { validateFileAttachment } from '../../utils/file-attachment-validation';

/**
 * Options for uploading a file attachment
 */
export interface UploadFileAttachmentOptions {
  file: File;
  envelopeId: string;
  userId: number;
  requestMetadata?: RequestMetadata;
}

/**
 * Result of uploading a file attachment
 */
export interface UploadFileAttachmentResult {
  id: string;
  storageKey: string;
  hash: string;
  fileSize: number;
  contentType: string;
}

/**
 * Upload a file attachment to an envelope
 * 
 * This function orchestrates the complete file upload process:
 * 1. Validates file type and size
 * 2. Computes SHA-256 hash for integrity verification
 * 3. Stores file in the storage service (S3 or database)
 * 4. Creates EnvelopeAttachment database record
 * 5. Creates audit log entry
 * 
 * @param options - Upload options including file, envelope ID, and user ID
 * @returns Upload result with attachment metadata
 * @throws AppError if validation fails, envelope not found, or storage fails
 */
export async function uploadFileAttachment(
  options: UploadFileAttachmentOptions,
): Promise<UploadFileAttachmentResult> {
  const { file, envelopeId, userId, requestMetadata } = options;

  // 1. Validate file type and size
  const validation = validateFileAttachment(file);
  if (!validation.valid) {
    throw new AppError('INVALID_FILE', validation.error);
  }

  // 2. Verify envelope exists
  const envelope = await prisma.envelope.findUnique({
    where: { id: envelopeId },
    select: { id: true },
  });

  if (!envelope) {
    throw new AppError('ENVELOPE_NOT_FOUND', `Envelope ${envelopeId} not found`);
  }

  // 3. Compute file hash
  const arrayBuffer = await file.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);
  const hashBytes = sha256(fileBytes);
  const hash = bytesToHex(hashBytes);

  // 4. Store file using putFileServerSide pattern
  let storageResult;
  try {
    storageResult = await putFileServerSide(file);
  } catch (error) {
    throw new AppError(
      'STORAGE_FAILURE',
      `Failed to store file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  // 5. Create EnvelopeAttachment database record with type='file'
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
    // Rollback: attempt to clean up stored file would go here
    // Note: Current storage pattern doesn't provide a delete function
    console.error('Database error creating attachment:', error);
    throw new AppError(
      'DATABASE_ERROR',
      `Failed to create attachment record: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
    );
  }

  // 6. Create audit log entry
  try {
    await prisma.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_UPLOADED,
        envelopeId,
        user: { id: userId },
        requestMetadata,
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
    // Audit log failure should not prevent the upload from succeeding
    // Log the error but continue
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
