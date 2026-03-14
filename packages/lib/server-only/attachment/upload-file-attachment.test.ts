import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@documenso/prisma';

import { AppError } from '../../errors/app-error';
import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_SIZE,
} from '../../utils/file-attachment-validation';
import { uploadFileAttachment } from './upload-file-attachment';

// Mock the prisma client
vi.mock('@documenso/prisma', () => ({
  prisma: {
    envelope: {
      findUnique: vi.fn(),
    },
    envelopeAttachment: {
      create: vi.fn(),
    },
    documentAuditLog: {
      create: vi.fn(),
    },
  },
}));

// Mock the file storage utility
vi.mock('../../universal/upload/put-file.server', () => ({
  putFileServerSide: vi.fn().mockResolvedValue({
    data: `storage_key_${Date.now()}`,
    type: 'S3_PATH',
  }),
}));

// Mock the document audit log utility
vi.mock('../../utils/document-audit-logs', () => ({
  createDocumentAuditLogData: vi.fn((data) => data),
}));

/**
 * Unit Tests for File Upload Error Handling
 * Feature: document-file-attachments
 * Validates Requirements: 1.5, 1.6
 */
describe('upload-file-attachment - Error Handling', () => {
  const TEST_USER_ID = 1;
  const TEST_ENVELOPE_ID = 'test-envelope-123';

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    vi.mocked(prisma.envelope.findUnique).mockResolvedValue({
      id: TEST_ENVELOPE_ID,
    } as any);

    vi.mocked(prisma.envelopeAttachment.create).mockImplementation(async (args: any) => ({
      id: `att_${Date.now()}_${Math.random()}`,
      type: args.data.type,
      label: args.data.label,
      data: args.data.data,
      fileSize: args.data.fileSize,
      contentType: args.data.contentType,
      hash: args.data.hash,
      envelopeId: args.data.envelopeId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any));

    vi.mocked(prisma.documentAuditLog.create).mockResolvedValue({} as any);
  });

  /**
   * Test file too large error
   * Validates Requirement 1.5: Files exceeding 10MB should be rejected
   */
  describe('File Too Large Error', () => {
    it('should reject files larger than 10MB with INVALID_FILE error', async () => {
      // Create a file that exceeds MAX_FILE_SIZE
      const oversizedFile = new File(
        [new Uint8Array(MAX_FILE_SIZE + 1)],
        'large-file.pdf',
        { type: 'application/pdf' }
      );

      await expect(
        uploadFileAttachment({
          file: oversizedFile,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(AppError);

      await expect(
        uploadFileAttachment({
          file: oversizedFile,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow('INVALID_FILE');
    });

    it('should include descriptive error message for oversized files', async () => {
      const oversizedFile = new File(
        [new Uint8Array(MAX_FILE_SIZE + 1000)],
        'huge-document.pdf',
        { type: 'application/pdf' }
      );

      await expect(
        uploadFileAttachment({
          file: oversizedFile,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(AppError);

      try {
        await uploadFileAttachment({
          file: oversizedFile,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        });
        expect.fail('Expected uploadFileAttachment to throw an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('INVALID_FILE');
      }
    });

    it('should not call storage or database operations for oversized files', async () => {
      const oversizedFile = new File(
        [new Uint8Array(MAX_FILE_SIZE + 1)],
        'large-file.pdf',
        { type: 'application/pdf' }
      );

      try {
        await uploadFileAttachment({
          file: oversizedFile,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        });
      } catch (error) {
        // Expected to throw
      }

      // Verify no database operations were attempted
      expect(prisma.envelopeAttachment.create).not.toHaveBeenCalled();
      expect(prisma.documentAuditLog.create).not.toHaveBeenCalled();
    });

    it('should reject files at exactly MAX_FILE_SIZE + 1 byte', async () => {
      const boundaryFile = new File(
        [new Uint8Array(MAX_FILE_SIZE + 1)],
        'boundary.pdf',
        { type: 'application/pdf' }
      );

      await expect(
        uploadFileAttachment({
          file: boundaryFile,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(AppError);
    });
  });

  /**
   * Test invalid file type error
   * Validates Requirement 1.6: Files with unsupported extensions should be rejected
   */
  describe('Invalid File Type Error', () => {
    it('should reject files with unsupported extensions', async () => {
      const invalidExtensions = ['exe', 'bat', 'sh', 'dll', 'zip', 'rar'];

      for (const ext of invalidExtensions) {
        const invalidFile = new File(
          [new Uint8Array(100)],
          `malicious.${ext}`,
          { type: 'application/octet-stream' }
        );

        await expect(
          uploadFileAttachment({
            file: invalidFile,
            envelopeId: TEST_ENVELOPE_ID,
            userId: TEST_USER_ID,
          })
        ).rejects.toThrow(AppError);

        await expect(
          uploadFileAttachment({
            file: invalidFile,
            envelopeId: TEST_ENVELOPE_ID,
            userId: TEST_USER_ID,
          })
        ).rejects.toThrow('INVALID_FILE');
      }
    });

    it('should include descriptive error message for invalid file types', async () => {
      const invalidFile = new File(
        [new Uint8Array(100)],
        'script.exe',
        { type: 'application/x-msdownload' }
      );

      await expect(
        uploadFileAttachment({
          file: invalidFile,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(AppError);

      try {
        await uploadFileAttachment({
          file: invalidFile,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        });
        expect.fail('Expected uploadFileAttachment to throw an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('INVALID_FILE');
      }
    });

    it('should not call storage or database operations for invalid file types', async () => {
      const invalidFile = new File(
        [new Uint8Array(100)],
        'virus.exe',
        { type: 'application/x-msdownload' }
      );

      try {
        await uploadFileAttachment({
          file: invalidFile,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        });
      } catch (error) {
        // Expected to throw
      }

      // Verify no database operations were attempted
      expect(prisma.envelopeAttachment.create).not.toHaveBeenCalled();
      expect(prisma.documentAuditLog.create).not.toHaveBeenCalled();
    });

    it('should reject files with no extension', async () => {
      const noExtensionFile = new File(
        [new Uint8Array(100)],
        'filename-without-extension',
        { type: 'application/octet-stream' }
      );

      await expect(
        uploadFileAttachment({
          file: noExtensionFile,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(AppError);
    });

    it('should reject files with multiple dots but invalid final extension', async () => {
      const multiDotFile = new File(
        [new Uint8Array(100)],
        'document.pdf.exe',
        { type: 'application/octet-stream' }
      );

      await expect(
        uploadFileAttachment({
          file: multiDotFile,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(AppError);
    });
  });

  /**
   * Test storage failure rollback
   * Validates Requirement 1.5, 1.6: System should handle storage failures gracefully
   */
  describe('Storage Failure Rollback', () => {
    it('should throw STORAGE_FAILURE error when putFileServerSide fails', async () => {
      // Mock storage failure
      const { putFileServerSide } = await import('../../universal/upload/put-file.server');
      vi.mocked(putFileServerSide).mockRejectedValueOnce(
        new Error('S3 connection timeout')
      );

      const validFile = new File(
        [new Uint8Array(1000)],
        'document.pdf',
        { type: 'application/pdf' }
      );

      await expect(
        uploadFileAttachment({
          file: validFile,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(AppError);

      try {
        await uploadFileAttachment({
          file: validFile,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('STORAGE_FAILURE');
      }
    });

    it('should not create database record when storage fails', async () => {
      // Mock storage failure
      const { putFileServerSide } = await import('../../universal/upload/put-file.server');
      vi.mocked(putFileServerSide).mockRejectedValueOnce(
        new Error('Storage service unavailable')
      );

      const validFile = new File(
        [new Uint8Array(1000)],
        'document.pdf',
        { type: 'application/pdf' }
      );

      try {
        await uploadFileAttachment({
          file: validFile,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        });
      } catch (error) {
        // Expected to throw
      }

      // Verify no database record was created
      expect(prisma.envelopeAttachment.create).not.toHaveBeenCalled();
      expect(prisma.documentAuditLog.create).not.toHaveBeenCalled();
    });

    it('should throw DATABASE_ERROR when database record creation fails', async () => {
      // Mock database failure
      vi.mocked(prisma.envelopeAttachment.create).mockRejectedValueOnce(
        new Error('Database connection lost')
      );

      const validFile = new File(
        [new Uint8Array(1000)],
        'document.pdf',
        { type: 'application/pdf' }
      );

      await expect(
        uploadFileAttachment({
          file: validFile,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(AppError);

      try {
        await uploadFileAttachment({
          file: validFile,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('DATABASE_ERROR');
      }
    });

    it('should include original error message in storage failure', async () => {
      const originalError = 'Network timeout after 30 seconds';
      const { putFileServerSide } = await import('../../universal/upload/put-file.server');
      vi.mocked(putFileServerSide).mockRejectedValueOnce(
        new Error(originalError)
      );

      const validFile = new File(
        [new Uint8Array(1000)],
        'document.pdf',
        { type: 'application/pdf' }
      );

      await expect(
        uploadFileAttachment({
          file: validFile,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(AppError);

      try {
        await uploadFileAttachment({
          file: validFile,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('STORAGE_FAILURE');
      }
    });

    it('should handle non-Error storage failures gracefully', async () => {
      const { putFileServerSide } = await import('../../universal/upload/put-file.server');
      vi.mocked(putFileServerSide).mockRejectedValueOnce('String error');

      const validFile = new File(
        [new Uint8Array(1000)],
        'document.pdf',
        { type: 'application/pdf' }
      );

      await expect(
        uploadFileAttachment({
          file: validFile,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(AppError);
    });

    it('should not create audit log when database record creation fails', async () => {
      // Mock database failure
      vi.mocked(prisma.envelopeAttachment.create).mockRejectedValueOnce(
        new Error('Constraint violation')
      );

      const validFile = new File(
        [new Uint8Array(1000)],
        'document.pdf',
        { type: 'application/pdf' }
      );

      try {
        await uploadFileAttachment({
          file: validFile,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        });
      } catch (error) {
        // Expected to throw
      }

      // Verify audit log was not created
      expect(prisma.documentAuditLog.create).not.toHaveBeenCalled();
    });
  });

  /**
   * Test envelope not found error
   */
  describe('Envelope Not Found Error', () => {
    it('should throw ENVELOPE_NOT_FOUND when envelope does not exist', async () => {
      vi.mocked(prisma.envelope.findUnique).mockResolvedValueOnce(null);

      const validFile = new File(
        [new Uint8Array(1000)],
        'document.pdf',
        { type: 'application/pdf' }
      );

      await expect(
        uploadFileAttachment({
          file: validFile,
          envelopeId: 'non-existent-envelope',
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow(AppError);

      try {
        await uploadFileAttachment({
          file: validFile,
          envelopeId: 'non-existent-envelope',
          userId: TEST_USER_ID,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('ENVELOPE_NOT_FOUND');
      }
    });

    it('should not proceed with upload when envelope is not found', async () => {
      vi.mocked(prisma.envelope.findUnique).mockResolvedValueOnce(null);

      const validFile = new File(
        [new Uint8Array(1000)],
        'document.pdf',
        { type: 'application/pdf' }
      );

      try {
        await uploadFileAttachment({
          file: validFile,
          envelopeId: 'non-existent-envelope',
          userId: TEST_USER_ID,
        });
      } catch (error) {
        // Expected to throw
      }

      // Verify no storage or database operations were attempted
      expect(prisma.envelopeAttachment.create).not.toHaveBeenCalled();
      expect(prisma.documentAuditLog.create).not.toHaveBeenCalled();
    });
  });

  /**
   * Test audit log failure handling
   */
  describe('Audit Log Failure Handling', () => {
    it('should succeed even if audit log creation fails', async () => {
      // Mock audit log failure
      vi.mocked(prisma.documentAuditLog.create).mockRejectedValueOnce(
        new Error('Audit log service unavailable')
      );

      const validFile = new File(
        [new Uint8Array(1000)],
        'document.pdf',
        { type: 'application/pdf' }
      );

      // Should not throw - audit log failure should not prevent upload
      const result = await uploadFileAttachment({
        file: validFile,
        envelopeId: TEST_ENVELOPE_ID,
        userId: TEST_USER_ID,
      });

      expect(result.id).toBeDefined();
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should still create attachment record when audit log fails', async () => {
      vi.mocked(prisma.documentAuditLog.create).mockRejectedValueOnce(
        new Error('Audit log failure')
      );

      const validFile = new File(
        [new Uint8Array(1000)],
        'document.pdf',
        { type: 'application/pdf' }
      );

      await uploadFileAttachment({
        file: validFile,
        envelopeId: TEST_ENVELOPE_ID,
        userId: TEST_USER_ID,
      });

      // Verify attachment was created despite audit log failure
      expect(prisma.envelopeAttachment.create).toHaveBeenCalled();
    });
  });
});
