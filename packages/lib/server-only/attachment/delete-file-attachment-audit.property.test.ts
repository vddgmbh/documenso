import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';
import { DocumentStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { deleteFileAttachment } from './delete-file-attachment';

// Mock the prisma client
vi.mock('@documenso/prisma', () => ({
  prisma: {
    envelopeAttachment: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    documentAuditLog: {
      create: vi.fn(),
    },
  },
}));

// Mock the file deletion utility
vi.mock('../../universal/upload/delete-file', () => ({
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock the audit log function
vi.mock('../envelope-attachment/log-file-attachment-audit', () => ({
  logFileAttachmentDelete: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Property-Based Tests for File Deletion Audit Logging
 * Feature: document-file-attachments
 */
describe('delete-file-attachment - Audit Logging Property Tests', () => {
  const TEST_USER_ID = 1;
  const TEST_ENVELOPE_ID = 'test-envelope-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 14: Deletion Audit Logging
   * **Validates: Requirements 8.3**
   *
   * For any file attachment deletion, an audit log entry should be created
   * with the deletion timestamp, user ID, and filename.
   */
  describe('Property 14: Deletion Audit Logging', () => {
    it('should create audit log entry for any file attachment deletion', async () => {
      // Generator for file attachment metadata
      const fileAttachmentGen = fc.record({
        id: fc.uuid(),
        label: fc
          .string({ minLength: 1, maxLength: 100 })
          .filter((s) => s.trim() !== '')
          .map((s) => `${s}.pdf`),
        storageKey: fc.uuid().map((id) => `storage/${id}`),
        fileSize: fc.integer({ min: 1, max: 10 * 1024 * 1024 }),
        contentType: fc.constantFrom(
          'application/pdf',
          'image/png',
          'image/jpeg',
          'text/plain',
          'text/csv',
        ),
        userId: fc.integer({ min: 1, max: 10000 }),
      });

      await fc.assert(
        fc.asyncProperty(fileAttachmentGen, async (attachment) => {
          vi.clearAllMocks();

          // Setup mocks for draft envelope
          vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
            id: attachment.id,
            type: 'file',
            label: attachment.label,
            data: attachment.storageKey,
            fileSize: attachment.fileSize,
            contentType: attachment.contentType,
            hash: 'abc123',
            envelopeId: TEST_ENVELOPE_ID,
            createdAt: new Date(),
            updatedAt: new Date(),
            envelope: {
              id: TEST_ENVELOPE_ID,
              status: DocumentStatus.DRAFT,
              userId: attachment.userId,
            },
          } as any);

          vi.mocked(prisma.envelopeAttachment.delete).mockResolvedValue({} as any);

          const { deleteFile } = await import('../../universal/upload/delete-file');
          vi.mocked(deleteFile).mockResolvedValue(undefined);

          const { logFileAttachmentDelete } = await import(
            '../envelope-attachment/log-file-attachment-audit'
          );
          vi.mocked(logFileAttachmentDelete).mockResolvedValue(undefined);

          // Perform deletion
          await deleteFileAttachment({
            attachmentId: attachment.id,
            userId: attachment.userId,
          });

          // Verify audit log was created with correct parameters
          expect(logFileAttachmentDelete).toHaveBeenCalledWith({
            attachmentId: attachment.id,
            filename: attachment.label,
            userId: attachment.userId,
            envelopeId: TEST_ENVELOPE_ID,
            metadata: undefined,
          });

          // Verify audit log was called exactly once
          expect(logFileAttachmentDelete).toHaveBeenCalledTimes(1);
        }),
        { numRuns: 100 },
      );
    });

    it('should create audit log with correct filename for various file types', async () => {
      // Test audit logging across different file types and names
      const fileTypeGen = fc.record({
        id: fc.uuid(),
        basename: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim() !== ''),
        extension: fc.constantFrom('pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'txt', 'csv'),
        userId: fc.integer({ min: 1, max: 10000 }),
      });

      await fc.assert(
        fc.asyncProperty(fileTypeGen, async (fileSpec) => {
          vi.clearAllMocks();

          const filename = `${fileSpec.basename}.${fileSpec.extension}`;
          const storageKey = `storage/${fileSpec.id}`;

          vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
            id: fileSpec.id,
            type: 'file',
            label: filename,
            data: storageKey,
            fileSize: 1000,
            contentType: 'application/octet-stream',
            hash: 'hash123',
            envelopeId: TEST_ENVELOPE_ID,
            createdAt: new Date(),
            updatedAt: new Date(),
            envelope: {
              id: TEST_ENVELOPE_ID,
              status: DocumentStatus.DRAFT,
              userId: fileSpec.userId,
            },
          } as any);

          vi.mocked(prisma.envelopeAttachment.delete).mockResolvedValue({} as any);

          const { deleteFile } = await import('../../universal/upload/delete-file');
          vi.mocked(deleteFile).mockResolvedValue(undefined);

          const { logFileAttachmentDelete } = await import(
            '../envelope-attachment/log-file-attachment-audit'
          );
          vi.mocked(logFileAttachmentDelete).mockResolvedValue(undefined);

          await deleteFileAttachment({
            attachmentId: fileSpec.id,
            userId: fileSpec.userId,
          });

          // Verify audit log contains the correct filename
          expect(logFileAttachmentDelete).toHaveBeenCalledWith(
            expect.objectContaining({
              filename: filename,
            }),
          );
        }),
        { numRuns: 100 },
      );
    });

    it('should create audit log with correct user ID for different users', async () => {
      // Test audit logging for various user IDs
      const userGen = fc.record({
        attachmentId: fc.uuid(),
        userId: fc.integer({ min: 1, max: 100000 }),
        filename: fc
          .string({ minLength: 1, maxLength: 100 })
          .filter((s) => s.trim() !== '')
          .map((s) => `${s}.pdf`),
      });

      await fc.assert(
        fc.asyncProperty(userGen, async (spec) => {
          vi.clearAllMocks();

          vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
            id: spec.attachmentId,
            type: 'file',
            label: spec.filename,
            data: `storage/${spec.attachmentId}`,
            fileSize: 1000,
            contentType: 'application/pdf',
            hash: 'hash123',
            envelopeId: TEST_ENVELOPE_ID,
            createdAt: new Date(),
            updatedAt: new Date(),
            envelope: {
              id: TEST_ENVELOPE_ID,
              status: DocumentStatus.DRAFT,
              userId: spec.userId,
            },
          } as any);

          vi.mocked(prisma.envelopeAttachment.delete).mockResolvedValue({} as any);

          const { deleteFile } = await import('../../universal/upload/delete-file');
          vi.mocked(deleteFile).mockResolvedValue(undefined);

          const { logFileAttachmentDelete } = await import(
            '../envelope-attachment/log-file-attachment-audit'
          );
          vi.mocked(logFileAttachmentDelete).mockResolvedValue(undefined);

          await deleteFileAttachment({
            attachmentId: spec.attachmentId,
            userId: spec.userId,
          });

          // Verify audit log contains the correct user ID
          expect(logFileAttachmentDelete).toHaveBeenCalledWith(
            expect.objectContaining({
              userId: spec.userId,
            }),
          );
        }),
        { numRuns: 100 },
      );
    });

    it('should create audit log with correct envelope ID', async () => {
      // Test that audit log includes the envelope ID
      const envelopeGen = fc.record({
        attachmentId: fc.uuid(),
        envelopeId: fc.uuid(),
        userId: fc.integer({ min: 1, max: 10000 }),
      });

      await fc.assert(
        fc.asyncProperty(envelopeGen, async (spec) => {
          vi.clearAllMocks();

          vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
            id: spec.attachmentId,
            type: 'file',
            label: 'test.pdf',
            data: `storage/${spec.attachmentId}`,
            fileSize: 1000,
            contentType: 'application/pdf',
            hash: 'hash123',
            envelopeId: spec.envelopeId,
            createdAt: new Date(),
            updatedAt: new Date(),
            envelope: {
              id: spec.envelopeId,
              status: DocumentStatus.DRAFT,
              userId: spec.userId,
            },
          } as any);

          vi.mocked(prisma.envelopeAttachment.delete).mockResolvedValue({} as any);

          const { deleteFile } = await import('../../universal/upload/delete-file');
          vi.mocked(deleteFile).mockResolvedValue(undefined);

          const { logFileAttachmentDelete } = await import(
            '../envelope-attachment/log-file-attachment-audit'
          );
          vi.mocked(logFileAttachmentDelete).mockResolvedValue(undefined);

          await deleteFileAttachment({
            attachmentId: spec.attachmentId,
            userId: spec.userId,
          });

          // Verify audit log contains the correct envelope ID
          expect(logFileAttachmentDelete).toHaveBeenCalledWith(
            expect.objectContaining({
              envelopeId: spec.envelopeId,
            }),
          );
        }),
        { numRuns: 100 },
      );
    });

    it('should create audit log even if storage deletion fails', async () => {
      // Test that audit log is created even when storage deletion fails
      const attachmentId = 'att_test_audit_on_storage_fail';
      const userId = 42;
      const filename = 'important.pdf';

      vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
        id: attachmentId,
        type: 'file',
        label: filename,
        data: 'storage/key',
        fileSize: 1000,
        contentType: 'application/pdf',
        hash: 'hash123',
        envelopeId: TEST_ENVELOPE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        envelope: {
          id: TEST_ENVELOPE_ID,
          status: DocumentStatus.DRAFT,
          userId: userId,
        },
      } as any);

      const { deleteFile } = await import('../../universal/upload/delete-file');
      vi.mocked(deleteFile).mockRejectedValue(new Error('Storage service unavailable'));

      vi.mocked(prisma.envelopeAttachment.delete).mockResolvedValue({} as any);

      const { logFileAttachmentDelete } = await import(
        '../envelope-attachment/log-file-attachment-audit'
      );
      vi.mocked(logFileAttachmentDelete).mockResolvedValue(undefined);

      // Deletion should succeed despite storage failure
      await deleteFileAttachment({
        attachmentId,
        userId,
      });

      // Verify audit log was still created
      expect(logFileAttachmentDelete).toHaveBeenCalledWith({
        attachmentId,
        filename,
        userId,
        envelopeId: TEST_ENVELOPE_ID,
        metadata: undefined,
      });
    });

    it('should not create audit log if deletion is prevented', async () => {
      // Test that audit log is NOT created when deletion fails due to envelope status
      const attachmentId = 'att_test_no_audit_on_fail';
      const userId = 42;

      vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
        id: attachmentId,
        type: 'file',
        label: 'test.pdf',
        data: 'storage/key',
        fileSize: 1000,
        contentType: 'application/pdf',
        hash: 'hash123',
        envelopeId: TEST_ENVELOPE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        envelope: {
          id: TEST_ENVELOPE_ID,
          status: DocumentStatus.PENDING, // Not draft - deletion will fail
          userId: userId,
        },
      } as any);

      const { logFileAttachmentDelete } = await import(
        '../envelope-attachment/log-file-attachment-audit'
      );
      vi.mocked(logFileAttachmentDelete).mockResolvedValue(undefined);

      // Deletion should fail
      await expect(
        deleteFileAttachment({
          attachmentId,
          userId,
        }),
      ).rejects.toThrow();

      // Verify audit log was NOT created
      expect(logFileAttachmentDelete).not.toHaveBeenCalled();
    });

    it('should create audit log with attachment ID for tracking', async () => {
      // Test that audit log includes attachment ID for proper tracking
      const attachmentGen = fc.record({
        id: fc.uuid(),
        userId: fc.integer({ min: 1, max: 10000 }),
      });

      await fc.assert(
        fc.asyncProperty(attachmentGen, async (spec) => {
          vi.clearAllMocks();

          vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
            id: spec.id,
            type: 'file',
            label: 'document.pdf',
            data: `storage/${spec.id}`,
            fileSize: 1000,
            contentType: 'application/pdf',
            hash: 'hash123',
            envelopeId: TEST_ENVELOPE_ID,
            createdAt: new Date(),
            updatedAt: new Date(),
            envelope: {
              id: TEST_ENVELOPE_ID,
              status: DocumentStatus.DRAFT,
              userId: spec.userId,
            },
          } as any);

          vi.mocked(prisma.envelopeAttachment.delete).mockResolvedValue({} as any);

          const { deleteFile } = await import('../../universal/upload/delete-file');
          vi.mocked(deleteFile).mockResolvedValue(undefined);

          const { logFileAttachmentDelete } = await import(
            '../envelope-attachment/log-file-attachment-audit'
          );
          vi.mocked(logFileAttachmentDelete).mockResolvedValue(undefined);

          await deleteFileAttachment({
            attachmentId: spec.id,
            userId: spec.userId,
          });

          // Verify audit log contains the attachment ID
          expect(logFileAttachmentDelete).toHaveBeenCalledWith(
            expect.objectContaining({
              attachmentId: spec.id,
            }),
          );
        }),
        { numRuns: 100 },
      );
    });

    it('should handle audit log creation for files with special characters in names', async () => {
      // Test audit logging with various special characters in filenames
      const specialFilenameGen = fc.record({
        id: fc.uuid(),
        filename: fc
          .constantFrom(
            'file with spaces.pdf',
            'file-with-dashes.pdf',
            'file_with_underscores.pdf',
            'file.multiple.dots.pdf',
            'file(with)parens.pdf',
            'file[with]brackets.pdf',
            'file&with&ampersands.pdf',
            'file#with#hashes.pdf',
          ),
        userId: fc.integer({ min: 1, max: 10000 }),
      });

      await fc.assert(
        fc.asyncProperty(specialFilenameGen, async (spec) => {
          vi.clearAllMocks();

          vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
            id: spec.id,
            type: 'file',
            label: spec.filename,
            data: `storage/${spec.id}`,
            fileSize: 1000,
            contentType: 'application/pdf',
            hash: 'hash123',
            envelopeId: TEST_ENVELOPE_ID,
            createdAt: new Date(),
            updatedAt: new Date(),
            envelope: {
              id: TEST_ENVELOPE_ID,
              status: DocumentStatus.DRAFT,
              userId: spec.userId,
            },
          } as any);

          vi.mocked(prisma.envelopeAttachment.delete).mockResolvedValue({} as any);

          const { deleteFile } = await import('../../universal/upload/delete-file');
          vi.mocked(deleteFile).mockResolvedValue(undefined);

          const { logFileAttachmentDelete } = await import(
            '../envelope-attachment/log-file-attachment-audit'
          );
          vi.mocked(logFileAttachmentDelete).mockResolvedValue(undefined);

          await deleteFileAttachment({
            attachmentId: spec.id,
            userId: spec.userId,
          });

          // Verify audit log was created with the exact filename
          expect(logFileAttachmentDelete).toHaveBeenCalledWith(
            expect.objectContaining({
              filename: spec.filename,
            }),
          );
        }),
        { numRuns: 50 },
      );
    });
  });
});
