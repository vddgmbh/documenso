import { describe, expect, it } from 'vitest';

import {
  DOCUMENT_AUDIT_LOG_TYPE,
  ZDocumentAuditLogEventFileAttachmentDeletedSchema,
  ZDocumentAuditLogEventFileAttachmentDownloadedSchema,
  ZDocumentAuditLogEventFileAttachmentUploadedSchema,
} from '../document-audit-logs';

describe('File Attachment Audit Log Types', () => {
  describe('DOCUMENT_AUDIT_LOG_TYPE', () => {
    it('should include FILE_ATTACHMENT_UPLOADED', () => {
      expect(DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_UPLOADED).toBe('FILE_ATTACHMENT_UPLOADED');
    });

    it('should include FILE_ATTACHMENT_DOWNLOADED', () => {
      expect(DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_DOWNLOADED).toBe('FILE_ATTACHMENT_DOWNLOADED');
    });

    it('should include FILE_ATTACHMENT_DELETED', () => {
      expect(DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_DELETED).toBe('FILE_ATTACHMENT_DELETED');
    });
  });

  describe('ZDocumentAuditLogEventFileAttachmentUploadedSchema', () => {
    it('should validate correct FileAttachmentUploadedData', () => {
      const validData = {
        type: DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_UPLOADED,
        data: {
          attachmentId: 'att_123',
          filename: 'document.pdf',
          fileSize: 1024000,
          contentType: 'application/pdf',
          hash: 'a'.repeat(64), // SHA-256 hash
        },
      };

      const result = ZDocumentAuditLogEventFileAttachmentUploadedSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid FileAttachmentUploadedData', () => {
      const invalidData = {
        type: DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_UPLOADED,
        data: {
          attachmentId: 'att_123',
          filename: 'document.pdf',
          // Missing required fields: fileSize, contentType, hash
        },
      };

      const result = ZDocumentAuditLogEventFileAttachmentUploadedSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('ZDocumentAuditLogEventFileAttachmentDownloadedSchema', () => {
    it('should validate correct FileAttachmentDownloadedData', () => {
      const validData = {
        type: DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_DOWNLOADED,
        data: {
          attachmentId: 'att_123',
          filename: 'document.pdf',
        },
      };

      const result = ZDocumentAuditLogEventFileAttachmentDownloadedSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid FileAttachmentDownloadedData', () => {
      const invalidData = {
        type: DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_DOWNLOADED,
        data: {
          attachmentId: 'att_123',
          // Missing required field: filename
        },
      };

      const result = ZDocumentAuditLogEventFileAttachmentDownloadedSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('ZDocumentAuditLogEventFileAttachmentDeletedSchema', () => {
    it('should validate correct FileAttachmentDeletedData', () => {
      const validData = {
        type: DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_DELETED,
        data: {
          attachmentId: 'att_123',
          filename: 'document.pdf',
        },
      };

      const result = ZDocumentAuditLogEventFileAttachmentDeletedSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid FileAttachmentDeletedData', () => {
      const invalidData = {
        type: DOCUMENT_AUDIT_LOG_TYPE.FILE_ATTACHMENT_DELETED,
        data: {
          // Missing required fields: attachmentId, filename
        },
      };

      const result = ZDocumentAuditLogEventFileAttachmentDeletedSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
