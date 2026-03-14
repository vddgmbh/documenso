import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';

import { prisma } from '@documenso/prisma';

import {
  logFileAttachmentDelete,
  logFileAttachmentDownload,
  logFileAttachmentUpload,
} from './log-file-attachment-audit';

// Mock the prisma client
vi.mock('@documenso/prisma', () => ({
  prisma: {
    documentAuditLog: {
      create: vi.fn(),
    },
  },
}));

// Mock the createDocumentAuditLogData utility
vi.mock('@documenso/lib/utils/document-audit-logs', () => ({
  createDocumentAuditLogData: vi.fn((data) => data),
}));

describe('log-file-attachment-audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logFileAttachmentUpload', () => {
    it('should create an audit log entry for file upload with all required fields', async () => {
      const options = {
        attachmentId: 'att_123',
        filename: 'test-document.pdf',
        userId: 1,
        envelopeId: 'env_456',
        fileSize: 1024000,
        contentType: 'application/pdf',
        hash: 'abc123def456',
      };

      await logFileAttachmentUpload(options);

      expect(createDocumentAuditLogData).toHaveBeenCalledWith({
        type: DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_UPLOADED,
        envelopeId: options.envelopeId,
        data: {
          attachmentId: options.attachmentId,
          filename: options.filename,
          fileSize: options.fileSize,
          contentType: options.contentType,
          hash: options.hash,
        },
        user: {
          id: options.userId,
        },
        metadata: undefined,
      });

      expect(prisma.documentAuditLog.create).toHaveBeenCalledTimes(1);
    });

    it('should include metadata when provided', async () => {
      const options = {
        attachmentId: 'att_123',
        filename: 'test-document.pdf',
        userId: 1,
        envelopeId: 'env_456',
        fileSize: 1024000,
        contentType: 'application/pdf',
        hash: 'abc123def456',
        metadata: {
          requestMetadata: {
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
          },
        },
      };

      await logFileAttachmentUpload(options);

      expect(createDocumentAuditLogData).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: options.metadata,
        }),
      );
    });
  });

  describe('logFileAttachmentDownload', () => {
    it('should create an audit log entry for file download with userId', async () => {
      const options = {
        attachmentId: 'att_123',
        filename: 'test-document.pdf',
        userId: 1,
        envelopeId: 'env_456',
      };

      await logFileAttachmentDownload(options);

      expect(createDocumentAuditLogData).toHaveBeenCalledWith({
        type: DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_DOWNLOADED,
        envelopeId: options.envelopeId,
        data: {
          attachmentId: options.attachmentId,
          filename: options.filename,
        },
        user: {
          id: options.userId,
        },
        metadata: undefined,
      });

      expect(prisma.documentAuditLog.create).toHaveBeenCalledTimes(1);
    });

    it('should create an audit log entry for anonymous download (null userId)', async () => {
      const options = {
        attachmentId: 'att_123',
        filename: 'test-document.pdf',
        userId: null,
        envelopeId: 'env_456',
      };

      await logFileAttachmentDownload(options);

      expect(createDocumentAuditLogData).toHaveBeenCalledWith({
        type: DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_DOWNLOADED,
        envelopeId: options.envelopeId,
        data: {
          attachmentId: options.attachmentId,
          filename: options.filename,
        },
        user: null,
        metadata: undefined,
      });

      expect(prisma.documentAuditLog.create).toHaveBeenCalledTimes(1);
    });

    it('should include metadata when provided', async () => {
      const options = {
        attachmentId: 'att_123',
        filename: 'test-document.pdf',
        userId: 1,
        envelopeId: 'env_456',
        metadata: {
          requestMetadata: {
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
          },
        },
      };

      await logFileAttachmentDownload(options);

      expect(createDocumentAuditLogData).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: options.metadata,
        }),
      );
    });
  });

  describe('logFileAttachmentDelete', () => {
    it('should create an audit log entry for file deletion', async () => {
      const options = {
        attachmentId: 'att_123',
        filename: 'test-document.pdf',
        userId: 1,
        envelopeId: 'env_456',
      };

      await logFileAttachmentDelete(options);

      expect(createDocumentAuditLogData).toHaveBeenCalledWith({
        type: DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_DELETED,
        envelopeId: options.envelopeId,
        data: {
          attachmentId: options.attachmentId,
          filename: options.filename,
        },
        user: {
          id: options.userId,
        },
        metadata: undefined,
      });

      expect(prisma.documentAuditLog.create).toHaveBeenCalledTimes(1);
    });

    it('should include metadata when provided', async () => {
      const options = {
        attachmentId: 'att_123',
        filename: 'test-document.pdf',
        userId: 1,
        envelopeId: 'env_456',
        metadata: {
          requestMetadata: {
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
          },
        },
      };

      await logFileAttachmentDelete(options);

      expect(createDocumentAuditLogData).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: options.metadata,
        }),
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple audit log operations in sequence', async () => {
      const uploadOptions = {
        attachmentId: 'att_123',
        filename: 'test-document.pdf',
        userId: 1,
        envelopeId: 'env_456',
        fileSize: 1024000,
        contentType: 'application/pdf',
        hash: 'abc123def456',
      };

      const downloadOptions = {
        attachmentId: 'att_123',
        filename: 'test-document.pdf',
        userId: 2,
        envelopeId: 'env_456',
      };

      const deleteOptions = {
        attachmentId: 'att_123',
        filename: 'test-document.pdf',
        userId: 1,
        envelopeId: 'env_456',
      };

      // Upload
      await logFileAttachmentUpload(uploadOptions);
      expect(prisma.documentAuditLog.create).toHaveBeenCalledTimes(1);

      // Download
      await logFileAttachmentDownload(downloadOptions);
      expect(prisma.documentAuditLog.create).toHaveBeenCalledTimes(2);

      // Delete
      await logFileAttachmentDelete(deleteOptions);
      expect(prisma.documentAuditLog.create).toHaveBeenCalledTimes(3);

      // Verify each call had the correct type
      const calls = vi.mocked(createDocumentAuditLogData).mock.calls;
      expect(calls[0][0].type).toBe(DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_UPLOADED);
      expect(calls[1][0].type).toBe(DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_DOWNLOADED);
      expect(calls[2][0].type).toBe(DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_DELETED);
    });
  });
});
