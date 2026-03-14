import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';
import { DocumentStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError } from '../../errors/app-error';
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
 * Property-Based Tests for File Deletion
 * Feature: document-file-attachments
 */
describe('delete-file-attachment - Property-Based Tests', () => {
  const TEST_USER_ID = 1;
  const TEST_ENVELOPE_ID = 'test-envelope-123';

  // Storage for tracking deleted files
  const deletedFiles = new Set<string>();

  beforeEach(() => {
    vi.clearAllMocks();
    deletedFiles.clear();
  });

  /**
   * Property 15: Draft Deletion Permission
   * **Validates: Requirements 9.1**
   *
   * For any envelope in draft status, the uploader should be able to delete file attachments.
   */
  describe('Property 15: Draft Deletion Permission', () => {
    it('should allow deletion of any file attachment from draft envelopes', async () => {
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
        ),
      });

      await fc.assert(
        fc.asyncProperty(fileAttachmentGen, async (attachment) => {
          vi.clearAllMocks();
          deletedFiles.clear();

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
              status: DocumentStatus.DRAFT, // Draft status
              userId: TEST_USER_ID, // Owner matches
            },
          } as any);

          vi.mocked(prisma.envelopeAttachment.delete).mockImplementation(
            async (args: any) => {
              deletedFiles.add(args.where.id);
              return {} as any;
            },
          );

          const { deleteFile } = await import('../../universal/upload/delete-file');
          vi.mocked(deleteFile).mockResolvedValue(undefined);

          const { logFileAttachmentDelete } = await import(
            '../envelope-attachment/log-file-attachment-audit'
          );
          vi.mocked(logFileAttachmentDelete).mockResolvedValue(undefined);

          // Attempt deletion - should succeed
          await expect(
            deleteFileAttachment({
              attachmentId: attachment.id,
              userId: TEST_USER_ID,
            }),
          ).resolves.not.toThrow();

          // Verify attachment was found
          expect(prisma.envelopeAttachment.findUnique).toHaveBeenCalledWith({
            where: { id: attachment.id },
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

          // Verify file was deleted from storage
          expect(deleteFile).toHaveBeenCalledWith({
            type: expect.any(String),
            data: attachment.storageKey,
          });

          // Verify database record was deleted
          expect(prisma.envelopeAttachment.delete).toHaveBeenCalledWith({
            where: { id: attachment.id },
          });
          expect(deletedFiles.has(attachment.id)).toBe(true);

          // Verify audit log was created
          expect(logFileAttachmentDelete).toHaveBeenCalledWith({
            attachmentId: attachment.id,
            filename: attachment.label,
            userId: TEST_USER_ID,
            envelopeId: TEST_ENVELOPE_ID,
            metadata: undefined,
          });
        }),
        { numRuns: 100 },
      );
    });

    it('should allow deletion for different file types in draft envelopes', async () => {
      // Test deletion across various file types
      const fileTypeGen = fc.record({
        id: fc.uuid(),
        extension: fc.constantFrom('pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'txt', 'csv'),
        basename: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim() !== ''),
        contentType: fc.constantFrom(
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/gif',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'text/csv',
        ),
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
            contentType: fileSpec.contentType,
            hash: 'hash123',
            envelopeId: TEST_ENVELOPE_ID,
            createdAt: new Date(),
            updatedAt: new Date(),
            envelope: {
              id: TEST_ENVELOPE_ID,
              status: DocumentStatus.DRAFT,
              userId: TEST_USER_ID,
            },
          } as any);

          vi.mocked(prisma.envelopeAttachment.delete).mockResolvedValue({} as any);

          const { deleteFile } = await import('../../universal/upload/delete-file');
          vi.mocked(deleteFile).mockResolvedValue(undefined);

          const { logFileAttachmentDelete } = await import(
            '../envelope-attachment/log-file-attachment-audit'
          );
          vi.mocked(logFileAttachmentDelete).mockResolvedValue(undefined);

          // Deletion should succeed for any file type
          await expect(
            deleteFileAttachment({
              attachmentId: fileSpec.id,
              userId: TEST_USER_ID,
            }),
          ).resolves.not.toThrow();

          expect(deleteFile).toHaveBeenCalled();
          expect(prisma.envelopeAttachment.delete).toHaveBeenCalled();
        }),
        { numRuns: 50 },
      );
    });

    it('should allow deletion for files of various sizes in draft envelopes', async () => {
      // Test deletion across various file sizes
      const fileSizeGen = fc.record({
        id: fc.uuid(),
        size: fc.constantFrom(
          1, // Minimum
          1024, // 1KB
          100 * 1024, // 100KB
          1024 * 1024, // 1MB
          5 * 1024 * 1024, // 5MB
          10 * 1024 * 1024, // 10MB (max)
        ),
      });

      await fc.assert(
        fc.asyncProperty(fileSizeGen, async (fileSpec) => {
          vi.clearAllMocks();

          vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
            id: fileSpec.id,
            type: 'file',
            label: 'test.pdf',
            data: `storage/${fileSpec.id}`,
            fileSize: fileSpec.size,
            contentType: 'application/pdf',
            hash: 'hash123',
            envelopeId: TEST_ENVELOPE_ID,
            createdAt: new Date(),
            updatedAt: new Date(),
            envelope: {
              id: TEST_ENVELOPE_ID,
              status: DocumentStatus.DRAFT,
              userId: TEST_USER_ID,
            },
          } as any);

          vi.mocked(prisma.envelopeAttachment.delete).mockResolvedValue({} as any);

          const { deleteFile } = await import('../../universal/upload/delete-file');
          vi.mocked(deleteFile).mockResolvedValue(undefined);

          const { logFileAttachmentDelete } = await import(
            '../envelope-attachment/log-file-attachment-audit'
          );
          vi.mocked(logFileAttachmentDelete).mockResolvedValue(undefined);

          // Deletion should succeed regardless of file size
          await expect(
            deleteFileAttachment({
              attachmentId: fileSpec.id,
              userId: TEST_USER_ID,
            }),
          ).resolves.not.toThrow();

          expect(deleteFile).toHaveBeenCalled();
          expect(prisma.envelopeAttachment.delete).toHaveBeenCalled();
        }),
        { numRuns: 50 },
      );
    });
  });

  /**
   * Property 16: Sent Envelope Deletion Prevention
   * **Validates: Requirements 9.2**
   *
   * For any envelope that has been sent to recipients,
   * attempting to delete a file attachment should be prevented with an appropriate error.
   */
  describe('Property 16: Sent Envelope Deletion Prevention', () => {
    it('should prevent deletion of attachments from sent envelopes', async () => {
      // Generator for non-draft envelope statuses
      const sentStatusGen = fc.constantFrom(
        DocumentStatus.PENDING,
        DocumentStatus.COMPLETED,
      );

      // Generator for file attachment metadata
      const fileAttachmentGen = fc.record({
        id: fc.uuid(),
        label: fc
          .string({ minLength: 1, maxLength: 100 })
          .filter((s) => s.trim() !== '')
          .map((s) => `${s}.pdf`),
        storageKey: fc.uuid().map((id) => `storage/${id}`),
        status: sentStatusGen,
      });

      await fc.assert(
        fc.asyncProperty(fileAttachmentGen, async (attachment) => {
          vi.clearAllMocks();

          // Setup mocks for sent envelope (non-draft status)
          vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
            id: attachment.id,
            type: 'file',
            label: attachment.label,
            data: attachment.storageKey,
            fileSize: 1000,
            contentType: 'application/pdf',
            hash: 'abc123',
            envelopeId: TEST_ENVELOPE_ID,
            createdAt: new Date(),
            updatedAt: new Date(),
            envelope: {
              id: TEST_ENVELOPE_ID,
              status: attachment.status, // Non-draft status
              userId: TEST_USER_ID,
            },
          } as any);

          // Attempt deletion - should fail
          await expect(
            deleteFileAttachment({
              attachmentId: attachment.id,
              userId: TEST_USER_ID,
            }),
          ).rejects.toThrow(AppError);

          await expect(
            deleteFileAttachment({
              attachmentId: attachment.id,
              userId: TEST_USER_ID,
            }),
          ).rejects.toThrow('ENVELOPE_ALREADY_SENT');

          // Verify attachment was found
          expect(prisma.envelopeAttachment.findUnique).toHaveBeenCalled();

          // Verify no deletion operations were performed
          expect(prisma.envelopeAttachment.delete).not.toHaveBeenCalled();

          const { deleteFile } = await import('../../universal/upload/delete-file');
          expect(deleteFile).not.toHaveBeenCalled();
        }),
        { numRuns: 100 },
      );
    });

    it('should prevent deletion for all non-draft statuses', async () => {
      // Test each non-draft status explicitly
      const nonDraftStatuses = [
        DocumentStatus.PENDING,
        DocumentStatus.COMPLETED,
      ];

      for (const status of nonDraftStatuses) {
        vi.clearAllMocks();

        const attachmentId = `att_${Date.now()}_${Math.random()}`;

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
            status: status,
            userId: TEST_USER_ID,
          },
        } as any);

        await expect(
          deleteFileAttachment({
            attachmentId,
            userId: TEST_USER_ID,
          }),
        ).rejects.toThrow('ENVELOPE_ALREADY_SENT');

        expect(prisma.envelopeAttachment.delete).not.toHaveBeenCalled();
      }
    });

    it('should prevent deletion even if user is the owner', async () => {
      // Verify that even the envelope owner cannot delete from sent envelopes
      const ownerAttachmentGen = fc.record({
        id: fc.uuid(),
        ownerId: fc.integer({ min: 1, max: 1000 }),
        status: fc.constantFrom(DocumentStatus.PENDING, DocumentStatus.COMPLETED),
      });

      await fc.assert(
        fc.asyncProperty(ownerAttachmentGen, async (spec) => {
          vi.clearAllMocks();

          vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
            id: spec.id,
            type: 'file',
            label: 'document.pdf',
            data: 'storage/key',
            fileSize: 1000,
            contentType: 'application/pdf',
            hash: 'hash123',
            envelopeId: TEST_ENVELOPE_ID,
            createdAt: new Date(),
            updatedAt: new Date(),
            envelope: {
              id: TEST_ENVELOPE_ID,
              status: spec.status,
              userId: spec.ownerId, // User is the owner
            },
          } as any);

          // Even the owner cannot delete from sent envelopes
          await expect(
            deleteFileAttachment({
              attachmentId: spec.id,
              userId: spec.ownerId, // Same as envelope owner
            }),
          ).rejects.toThrow('ENVELOPE_ALREADY_SENT');

          expect(prisma.envelopeAttachment.delete).not.toHaveBeenCalled();
        }),
        { numRuns: 50 },
      );
    });

    it('should provide clear error message for sent envelope deletion attempts', async () => {
      const attachmentId = 'att_test_123';

      vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
        id: attachmentId,
        type: 'file',
        label: 'important.pdf',
        data: 'storage/key',
        fileSize: 5000,
        contentType: 'application/pdf',
        hash: 'hash123',
        envelopeId: TEST_ENVELOPE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        envelope: {
          id: TEST_ENVELOPE_ID,
          status: DocumentStatus.PENDING,
          userId: TEST_USER_ID,
        },
      } as any);

      try {
        await deleteFileAttachment({
          attachmentId,
          userId: TEST_USER_ID,
        });
        expect.fail('Expected deleteFileAttachment to throw an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('ENVELOPE_ALREADY_SENT');
        expect((error as AppError).message.toLowerCase()).toContain('sent');
      }
    });
  });

  /**
   * Property 17: Deletion Cleanup
   * **Validates: Requirements 9.3, 9.4**
   *
   * For any file attachment deletion, both the storage file and the database record should be removed.
   */
  describe('Property 17: Deletion Cleanup', () => {
    it('should remove both storage file and database record for any deletion', async () => {
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
      });

      await fc.assert(
        fc.asyncProperty(fileAttachmentGen, async (attachment) => {
          vi.clearAllMocks();

          // Track deletion calls
          let storageDeleted = false;
          let databaseDeleted = false;

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
              userId: TEST_USER_ID,
            },
          } as any);

          const { deleteFile } = await import('../../universal/upload/delete-file');
          vi.mocked(deleteFile).mockImplementation(async ({ data }) => {
            if (data === attachment.storageKey) {
              storageDeleted = true;
            }
          });

          vi.mocked(prisma.envelopeAttachment.delete).mockImplementation(
            async (args: any) => {
              if (args.where.id === attachment.id) {
                databaseDeleted = true;
              }
              return {} as any;
            },
          );

          const { logFileAttachmentDelete } = await import(
            '../envelope-attachment/log-file-attachment-audit'
          );
          vi.mocked(logFileAttachmentDelete).mockResolvedValue(undefined);

          // Perform deletion
          await deleteFileAttachment({
            attachmentId: attachment.id,
            userId: TEST_USER_ID,
          });

          // Verify both storage and database were cleaned up
          expect(storageDeleted).toBe(true);
          expect(databaseDeleted).toBe(true);

          // Verify deleteFile was called with correct parameters
          expect(deleteFile).toHaveBeenCalledWith({
            type: expect.any(String),
            data: attachment.storageKey,
          });

          // Verify database delete was called with correct parameters
          expect(prisma.envelopeAttachment.delete).toHaveBeenCalledWith({
            where: { id: attachment.id },
          });
        }),
        { numRuns: 100 },
      );
    });

    it('should clean up storage before database for proper rollback', async () => {
      // Verify deletion order: storage first, then database
      const attachmentId = 'att_test_order';
      const storageKey = 'storage/test-key';

      const deletionOrder: string[] = [];

      vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
        id: attachmentId,
        type: 'file',
        label: 'test.pdf',
        data: storageKey,
        fileSize: 1000,
        contentType: 'application/pdf',
        hash: 'hash123',
        envelopeId: TEST_ENVELOPE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        envelope: {
          id: TEST_ENVELOPE_ID,
          status: DocumentStatus.DRAFT,
          userId: TEST_USER_ID,
        },
      } as any);

      const { deleteFile } = await import('../../universal/upload/delete-file');
      vi.mocked(deleteFile).mockImplementation(async () => {
        deletionOrder.push('storage');
      });

      vi.mocked(prisma.envelopeAttachment.delete).mockImplementation(async () => {
        deletionOrder.push('database');
        return {} as any;
      });

      const { logFileAttachmentDelete } = await import(
        '../envelope-attachment/log-file-attachment-audit'
      );
      vi.mocked(logFileAttachmentDelete).mockResolvedValue(undefined);

      await deleteFileAttachment({
        attachmentId,
        userId: TEST_USER_ID,
      });

      // Verify storage was deleted before database
      expect(deletionOrder).toEqual(['storage', 'database']);
    });

    it('should delete database record even if storage deletion fails', async () => {
      // Test that database cleanup happens even if storage fails
      const attachmentId = 'att_test_storage_fail';
      const storageKey = 'storage/fail-key';

      let databaseDeleted = false;

      vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
        id: attachmentId,
        type: 'file',
        label: 'test.pdf',
        data: storageKey,
        fileSize: 1000,
        contentType: 'application/pdf',
        hash: 'hash123',
        envelopeId: TEST_ENVELOPE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        envelope: {
          id: TEST_ENVELOPE_ID,
          status: DocumentStatus.DRAFT,
          userId: TEST_USER_ID,
        },
      } as any);

      const { deleteFile } = await import('../../universal/upload/delete-file');
      vi.mocked(deleteFile).mockRejectedValue(new Error('Storage service unavailable'));

      vi.mocked(prisma.envelopeAttachment.delete).mockImplementation(async () => {
        databaseDeleted = true;
        return {} as any;
      });

      const { logFileAttachmentDelete } = await import(
        '../envelope-attachment/log-file-attachment-audit'
      );
      vi.mocked(logFileAttachmentDelete).mockResolvedValue(undefined);

      // Deletion should succeed despite storage failure
      await deleteFileAttachment({
        attachmentId,
        userId: TEST_USER_ID,
      });

      // Verify database was still deleted
      expect(databaseDeleted).toBe(true);
      expect(prisma.envelopeAttachment.delete).toHaveBeenCalled();
    });

    it('should clean up files of various types and sizes', async () => {
      // Test cleanup across different file characteristics
      const fileVarietyGen = fc.record({
        id: fc.uuid(),
        extension: fc.constantFrom('pdf', 'png', 'jpg', 'doc', 'txt', 'csv'),
        size: fc.constantFrom(1, 1024, 100 * 1024, 1024 * 1024, 10 * 1024 * 1024),
      });

      await fc.assert(
        fc.asyncProperty(fileVarietyGen, async (fileSpec) => {
          vi.clearAllMocks();

          let storageDeleted = false;
          let databaseDeleted = false;

          const storageKey = `storage/${fileSpec.id}`;

          vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
            id: fileSpec.id,
            type: 'file',
            label: `test.${fileSpec.extension}`,
            data: storageKey,
            fileSize: fileSpec.size,
            contentType: 'application/octet-stream',
            hash: 'hash123',
            envelopeId: TEST_ENVELOPE_ID,
            createdAt: new Date(),
            updatedAt: new Date(),
            envelope: {
              id: TEST_ENVELOPE_ID,
              status: DocumentStatus.DRAFT,
              userId: TEST_USER_ID,
            },
          } as any);

          const { deleteFile } = await import('../../universal/upload/delete-file');
          vi.mocked(deleteFile).mockImplementation(async ({ data }) => {
            if (data === storageKey) {
              storageDeleted = true;
            }
          });

          vi.mocked(prisma.envelopeAttachment.delete).mockImplementation(async () => {
            databaseDeleted = true;
            return {} as any;
          });

          const { logFileAttachmentDelete } = await import(
            '../envelope-attachment/log-file-attachment-audit'
          );
          vi.mocked(logFileAttachmentDelete).mockResolvedValue(undefined);

          await deleteFileAttachment({
            attachmentId: fileSpec.id,
            userId: TEST_USER_ID,
          });

          // Verify cleanup happened for all file types and sizes
          expect(storageDeleted).toBe(true);
          expect(databaseDeleted).toBe(true);
        }),
        { numRuns: 50 },
      );
    });
  });
});
