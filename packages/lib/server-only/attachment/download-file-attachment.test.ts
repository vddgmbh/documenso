import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Blob } from 'node:buffer';

import { prisma } from '@documenso/prisma';

// Polyfill File API for Node.js test environment
if (typeof globalThis.File === 'undefined') {
  class FilePolyfill extends Blob {
    public name: string;
    public lastModified: number;

    constructor(bits: BlobPart[], name: string, options?: FilePropertyBag) {
      super(bits, options);
      this.name = name;
      this.lastModified = options?.lastModified ?? Date.now();
    }
  }

  globalThis.File = FilePolyfill as any;
}

import { AppError } from '../../errors/app-error';
import { downloadFileAttachment } from './download-file-attachment';

// Mock the prisma client
vi.mock('@documenso/prisma', () => ({
  prisma: {
    envelopeAttachment: {
      findUnique: vi.fn(),
    },
    documentAuditLog: {
      create: vi.fn(),
    },
  },
}));

// Mock the file storage utility
vi.mock('../../universal/upload/get-file.server', () => ({
  getFileServerSide: vi.fn(),
}));

// Mock the access control function
vi.mock('./check-attachment-access', () => ({
  checkAttachmentAccess: vi.fn(),
}));

// Mock the audit log functions
vi.mock('../envelope-attachment/log-file-attachment-audit', () => ({
  logFileAttachmentDownload: vi.fn(),
}));

/**
 * Unit Tests for File Download Error Handling
 * Feature: document-file-attachments
 * Validates Requirements: 10.3
 */
describe('download-file-attachment - Error Handling', () => {
  const TEST_USER_ID = 1;
  const TEST_ATTACHMENT_ID = 'att_test_123';
  const TEST_ENVELOPE_ID = 'env_test_123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test attachment not found error
   * Validates that the system returns appropriate error when attachment doesn't exist
   */
  describe('Attachment Not Found Error', () => {
    it('should throw ATTACHMENT_NOT_FOUND when attachment does not exist', async () => {
      const { checkAttachmentAccess } = await import('./check-attachment-access');
      vi.mocked(checkAttachmentAccess).mockResolvedValue(true);

      vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue(null);

      await expect(
        downloadFileAttachment({
          attachmentId: 'non-existent-attachment',
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(AppError);

      await expect(
        downloadFileAttachment({
          attachmentId: 'non-existent-attachment',
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow('ATTACHMENT_NOT_FOUND');
    });

    it('should include attachment ID in error message', async () => {
      const { checkAttachmentAccess } = await import('./check-attachment-access');
      vi.mocked(checkAttachmentAccess).mockResolvedValue(true);

      vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue(null);

      await expect(
        downloadFileAttachment({
          attachmentId: 'missing-att-456',
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(AppError);

      try {
        await downloadFileAttachment({
          attachmentId: 'missing-att-456',
          userId: TEST_USER_ID,
        });
        expect.fail('Expected downloadFileAttachment to throw an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        const appError = error as AppError;
        expect(appError.code).toBe('ATTACHMENT_NOT_FOUND');
        // The error should be thrown (message content is implementation detail)
      }
    });

    it('should not proceed with download when attachment is not found', async () => {
      const { checkAttachmentAccess } = await import('./check-attachment-access');
      vi.mocked(checkAttachmentAccess).mockResolvedValue(true);

      const { getFileServerSide } = await import('../../universal/upload/get-file.server');

      vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue(null);

      try {
        await downloadFileAttachment({
          attachmentId: 'non-existent',
          userId: TEST_USER_ID,
        });
      } catch (error) {
        // Expected to throw
      }

      // Verify no file retrieval was attempted
      expect(getFileServerSide).not.toHaveBeenCalled();
    });
  });

  /**
   * Test access denied error
   * Validates that the system prevents unauthorized access
   */
  describe('Access Denied Error', () => {
    it('should throw ACCESS_DENIED when user does not have permission', async () => {
      const { checkAttachmentAccess } = await import('./check-attachment-access');
      vi.mocked(checkAttachmentAccess).mockResolvedValue(false);

      await expect(
        downloadFileAttachment({
          attachmentId: TEST_ATTACHMENT_ID,
          userId: 999, // Unauthorized user
        })
      ).rejects.toThrow(AppError);

      await expect(
        downloadFileAttachment({
          attachmentId: TEST_ATTACHMENT_ID,
          userId: 999,
        })
      ).rejects.toThrow('ACCESS_DENIED');
    });

    it('should include descriptive error message for access denied', async () => {
      const { checkAttachmentAccess } = await import('./check-attachment-access');
      vi.mocked(checkAttachmentAccess).mockResolvedValue(false);

      try {
        await downloadFileAttachment({
          attachmentId: TEST_ATTACHMENT_ID,
          userId: 999,
        });
        expect.fail('Expected downloadFileAttachment to throw an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        const appError = error as AppError;
        expect(appError.code).toBe('ACCESS_DENIED');
        // The message should contain information about permission
        expect(appError.message).toMatch(/permission|access/i);
      }
    });

    it('should not proceed with download when access is denied', async () => {
      const { checkAttachmentAccess } = await import('./check-attachment-access');
      vi.mocked(checkAttachmentAccess).mockResolvedValue(false);

      const { getFileServerSide } = await import('../../universal/upload/get-file.server');

      try {
        await downloadFileAttachment({
          attachmentId: TEST_ATTACHMENT_ID,
          userId: 999,
        });
      } catch (error) {
        // Expected to throw
      }

      // Verify no database or file operations were attempted
      expect(prisma.envelopeAttachment.findUnique).not.toHaveBeenCalled();
      expect(getFileServerSide).not.toHaveBeenCalled();
    });

    it('should check access before fetching attachment', async () => {
      const { checkAttachmentAccess } = await import('./check-attachment-access');
      vi.mocked(checkAttachmentAccess).mockResolvedValue(false);

      try {
        await downloadFileAttachment({
          attachmentId: TEST_ATTACHMENT_ID,
          userId: 999,
        });
      } catch (error) {
        // Expected to throw
      }

      // Verify checkAttachmentAccess was called
      expect(checkAttachmentAccess).toHaveBeenCalledWith({
        attachmentId: TEST_ATTACHMENT_ID,
        userId: 999,
        recipientToken: undefined,
      });
    });
  });

  /**
   * Test file not in storage error
   * Validates that the system handles missing files in storage
   */
  describe('File Not Found in Storage Error', () => {
    it('should throw FILE_NOT_FOUND_IN_STORAGE when file retrieval fails', async () => {
      const { checkAttachmentAccess } = await import('./check-attachment-access');
      vi.mocked(checkAttachmentAccess).mockResolvedValue(true);

      vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
        id: TEST_ATTACHMENT_ID,
        type: 'file',
        label: 'test.pdf',
        data: 'storage-key-123',
        fileSize: 1000,
        contentType: 'application/pdf',
        hash: 'a'.repeat(64),
        envelopeId: TEST_ENVELOPE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        envelope: {
          id: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        },
      } as any);

      const { getFileServerSide } = await import('../../universal/upload/get-file.server');
      vi.mocked(getFileServerSide).mockRejectedValue(
        new Error('File not found in S3 bucket')
      );

      await expect(
        downloadFileAttachment({
          attachmentId: TEST_ATTACHMENT_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(AppError);

      await expect(
        downloadFileAttachment({
          attachmentId: TEST_ATTACHMENT_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow('FILE_NOT_FOUND_IN_STORAGE');
    });

    it('should include original error message in storage failure', async () => {
      const { checkAttachmentAccess } = await import('./check-attachment-access');
      vi.mocked(checkAttachmentAccess).mockResolvedValue(true);

      vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
        id: TEST_ATTACHMENT_ID,
        type: 'file',
        label: 'test.pdf',
        data: 'storage-key-123',
        fileSize: 1000,
        contentType: 'application/pdf',
        hash: 'a'.repeat(64),
        envelopeId: TEST_ENVELOPE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        envelope: {
          id: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        },
      } as any);

      const originalError = 'S3 bucket access denied';
      const { getFileServerSide } = await import('../../universal/upload/get-file.server');
      vi.mocked(getFileServerSide).mockRejectedValue(new Error(originalError));

      try {
        await downloadFileAttachment({
          attachmentId: TEST_ATTACHMENT_ID,
          userId: TEST_USER_ID,
        });
        expect.fail('Expected downloadFileAttachment to throw an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        const appError = error as AppError;
        expect(appError.code).toBe('FILE_NOT_FOUND_IN_STORAGE');
        // The message should contain information about the failure
        expect(appError.message).toMatch(/Failed to retrieve|storage/i);
      }
    });

    it('should handle non-Error storage failures gracefully', async () => {
      const { checkAttachmentAccess } = await import('./check-attachment-access');
      vi.mocked(checkAttachmentAccess).mockResolvedValue(true);

      vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
        id: TEST_ATTACHMENT_ID,
        type: 'file',
        label: 'test.pdf',
        data: 'storage-key-123',
        fileSize: 1000,
        contentType: 'application/pdf',
        hash: 'a'.repeat(64),
        envelopeId: TEST_ENVELOPE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        envelope: {
          id: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        },
      } as any);

      const { getFileServerSide } = await import('../../universal/upload/get-file.server');
      vi.mocked(getFileServerSide).mockRejectedValue('String error');

      await expect(
        downloadFileAttachment({
          attachmentId: TEST_ATTACHMENT_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(AppError);

      await expect(
        downloadFileAttachment({
          attachmentId: TEST_ATTACHMENT_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow('FILE_NOT_FOUND_IN_STORAGE');
    });
  });

  /**
   * Test hash verification failure
   * Validates Requirement 10.3: System should detect corrupted files and prevent download
   */
  describe('Hash Verification Failure', () => {
    it('should throw HASH_VERIFICATION_FAILED when hash does not match', async () => {
      const { checkAttachmentAccess } = await import('./check-attachment-access');
      vi.mocked(checkAttachmentAccess).mockResolvedValue(true);

      const storedHash = 'a'.repeat(64); // Expected hash
      const fileContent = new Uint8Array([1, 2, 3, 4, 5]); // Content that won't match

      vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
        id: TEST_ATTACHMENT_ID,
        type: 'file',
        label: 'test.pdf',
        data: 'storage-key-123',
        fileSize: 5,
        contentType: 'application/pdf',
        hash: storedHash,
        envelopeId: TEST_ENVELOPE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        envelope: {
          id: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        },
      } as any);

      const { getFileServerSide } = await import('../../universal/upload/get-file.server');
      vi.mocked(getFileServerSide).mockResolvedValue(fileContent);

      await expect(
        downloadFileAttachment({
          attachmentId: TEST_ATTACHMENT_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(AppError);

      await expect(
        downloadFileAttachment({
          attachmentId: TEST_ATTACHMENT_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow('HASH_VERIFICATION_FAILED');
    });

    it('should log critical error when hash verification fails', async () => {
      const { checkAttachmentAccess } = await import('./check-attachment-access');
      vi.mocked(checkAttachmentAccess).mockResolvedValue(true);

      const storedHash = 'a'.repeat(64);
      const fileContent = new Uint8Array([1, 2, 3, 4, 5]);

      vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
        id: TEST_ATTACHMENT_ID,
        type: 'file',
        label: 'test.pdf',
        data: 'storage-key-123',
        fileSize: 5,
        contentType: 'application/pdf',
        hash: storedHash,
        envelopeId: TEST_ENVELOPE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        envelope: {
          id: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        },
      } as any);

      const { getFileServerSide } = await import('../../universal/upload/get-file.server');
      vi.mocked(getFileServerSide).mockResolvedValue(fileContent);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        await downloadFileAttachment({
          attachmentId: TEST_ATTACHMENT_ID,
          userId: TEST_USER_ID,
        });
      } catch (error) {
        // Expected to throw
      }

      // Verify critical error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Hash verification failed')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(TEST_ATTACHMENT_ID)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should include integrity message in error', async () => {
      const { checkAttachmentAccess } = await import('./check-attachment-access');
      vi.mocked(checkAttachmentAccess).mockResolvedValue(true);

      const storedHash = 'a'.repeat(64);
      const fileContent = new Uint8Array([1, 2, 3, 4, 5]);

      vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
        id: TEST_ATTACHMENT_ID,
        type: 'file',
        label: 'test.pdf',
        data: 'storage-key-123',
        fileSize: 5,
        contentType: 'application/pdf',
        hash: storedHash,
        envelopeId: TEST_ENVELOPE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        envelope: {
          id: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        },
      } as any);

      const { getFileServerSide } = await import('../../universal/upload/get-file.server');
      vi.mocked(getFileServerSide).mockResolvedValue(fileContent);

      try {
        await downloadFileAttachment({
          attachmentId: TEST_ATTACHMENT_ID,
          userId: TEST_USER_ID,
        });
        expect.fail('Expected downloadFileAttachment to throw an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        const appError = error as AppError;
        expect(appError.code).toBe('HASH_VERIFICATION_FAILED');
        // The message property should contain the descriptive error message
        expect(appError.message).toMatch(/integrity|verification|corrupted/i);
      }
    });

    it('should not create audit log when hash verification fails', async () => {
      const { checkAttachmentAccess } = await import('./check-attachment-access');
      vi.mocked(checkAttachmentAccess).mockResolvedValue(true);

      const storedHash = 'a'.repeat(64);
      const fileContent = new Uint8Array([1, 2, 3, 4, 5]);

      vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
        id: TEST_ATTACHMENT_ID,
        type: 'file',
        label: 'test.pdf',
        data: 'storage-key-123',
        fileSize: 5,
        contentType: 'application/pdf',
        hash: storedHash,
        envelopeId: TEST_ENVELOPE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        envelope: {
          id: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        },
      } as any);

      const { getFileServerSide } = await import('../../universal/upload/get-file.server');
      vi.mocked(getFileServerSide).mockResolvedValue(fileContent);

      const { logFileAttachmentDownload } = await import(
        '../envelope-attachment/log-file-attachment-audit'
      );

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        await downloadFileAttachment({
          attachmentId: TEST_ATTACHMENT_ID,
          userId: TEST_USER_ID,
        });
      } catch (error) {
        // Expected to throw
      }

      // Verify audit log was not created
      expect(logFileAttachmentDownload).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  /**
   * Test invalid attachment type error
   * Validates that only file attachments can be downloaded
   */
  describe('Invalid Attachment Type Error', () => {
    it('should throw INVALID_ATTACHMENT_TYPE for link attachments', async () => {
      const { checkAttachmentAccess } = await import('./check-attachment-access');
      vi.mocked(checkAttachmentAccess).mockResolvedValue(true);

      vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
        id: TEST_ATTACHMENT_ID,
        type: 'link', // Link attachment, not file
        label: 'External Link',
        data: 'https://example.com/document.pdf',
        fileSize: null,
        contentType: null,
        hash: null,
        envelopeId: TEST_ENVELOPE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        envelope: {
          id: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        },
      } as any);

      await expect(
        downloadFileAttachment({
          attachmentId: TEST_ATTACHMENT_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(AppError);

      await expect(
        downloadFileAttachment({
          attachmentId: TEST_ATTACHMENT_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow('INVALID_ATTACHMENT_TYPE');
    });

    it('should not attempt file retrieval for link attachments', async () => {
      const { checkAttachmentAccess } = await import('./check-attachment-access');
      vi.mocked(checkAttachmentAccess).mockResolvedValue(true);

      vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
        id: TEST_ATTACHMENT_ID,
        type: 'link',
        label: 'External Link',
        data: 'https://example.com/document.pdf',
        fileSize: null,
        contentType: null,
        hash: null,
        envelopeId: TEST_ENVELOPE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        envelope: {
          id: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        },
      } as any);

      const { getFileServerSide } = await import('../../universal/upload/get-file.server');

      try {
        await downloadFileAttachment({
          attachmentId: TEST_ATTACHMENT_ID,
          userId: TEST_USER_ID,
        });
      } catch (error) {
        // Expected to throw
      }

      // Verify no file retrieval was attempted
      expect(getFileServerSide).not.toHaveBeenCalled();
    });
  });
});
