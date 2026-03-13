import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';

import { prisma } from '@documenso/prisma';

/**
 * Options for logging file attachment upload.
 */
export type LogFileAttachmentUploadOptions = {
  attachmentId: string;
  filename: string;
  userId: number;
  envelopeId: string;
  fileSize: number;
  contentType: string;
  hash: string;
  metadata?: ApiRequestMetadata;
};

/**
 * Options for logging file attachment download.
 */
export type LogFileAttachmentDownloadOptions = {
  attachmentId: string;
  filename: string;
  userId: number | null;
  envelopeId: string;
  metadata?: ApiRequestMetadata;
};

/**
 * Options for logging file attachment deletion.
 */
export type LogFileAttachmentDeleteOptions = {
  attachmentId: string;
  filename: string;
  userId: number;
  envelopeId: string;
  metadata?: ApiRequestMetadata;
};

/**
 * Log a file attachment upload event to the audit log.
 *
 * Creates an audit log entry with type FILE_ATTACHMENT_UPLOADED containing
 * the attachment ID, filename, file size, content type, and hash.
 *
 * @param options - The upload logging options
 * @returns Promise that resolves when the audit log entry is created
 */
export const logFileAttachmentUpload = async ({
  attachmentId,
  filename,
  userId,
  envelopeId,
  fileSize,
  contentType,
  hash,
  metadata,
}: LogFileAttachmentUploadOptions): Promise<void> => {
  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_UPLOADED,
      envelopeId,
      data: {
        attachmentId,
        filename,
        fileSize,
        contentType,
        hash,
      },
      user: {
        id: userId,
      },
      metadata,
    }),
  });
};

/**
 * Log a file attachment download event to the audit log.
 *
 * Creates an audit log entry with type FILE_ATTACHMENT_DOWNLOADED containing
 * the attachment ID and filename. The userId can be null for anonymous downloads
 * (e.g., when using a recipient token).
 *
 * @param options - The download logging options
 * @returns Promise that resolves when the audit log entry is created
 */
export const logFileAttachmentDownload = async ({
  attachmentId,
  filename,
  userId,
  envelopeId,
  metadata,
}: LogFileAttachmentDownloadOptions): Promise<void> => {
  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_DOWNLOADED,
      envelopeId,
      data: {
        attachmentId,
        filename,
      },
      user: userId
        ? {
            id: userId,
          }
        : null,
      metadata,
    }),
  });
};

/**
 * Log a file attachment deletion event to the audit log.
 *
 * Creates an audit log entry with type FILE_ATTACHMENT_DELETED containing
 * the attachment ID and filename.
 *
 * @param options - The deletion logging options
 * @returns Promise that resolves when the audit log entry is created
 */
export const logFileAttachmentDelete = async ({
  attachmentId,
  filename,
  userId,
  envelopeId,
  metadata,
}: LogFileAttachmentDeleteOptions): Promise<void> => {
  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_DELETED,
      envelopeId,
      data: {
        attachmentId,
        filename,
      },
      user: {
        id: userId,
      },
      metadata,
    }),
  });
};
