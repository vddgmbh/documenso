import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';

import { prisma } from '@documenso/prisma';

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
      findUnique: vi.fn(),
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
 * Property-Based Tests for File Upload
 * Feature: document-file-attachments
 */
describe('upload-file-attachment - Property-Based Tests', () => {
  // Test user ID and envelope ID
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
    }));

    vi.mocked(prisma.documentAuditLog.create).mockResolvedValue({} as any);
  });

  /**
   * Property 1: File Upload Acceptance
   * **Validates: Requirements 1.1, 1.3, 1.4**
   *
   * For any valid file (with allowed extension and size ≤ 10MB),
   * uploading it via multipart form data should result in a new
   * EnvelopeAttachment record with type='file' being created and
   * associated with the envelope.
   */
  describe('Property 1: File Upload Acceptance', () => {
    it('should accept and store all valid files with correct database records', async () => {
      // Generator for valid file extensions with random case
      const validExtensionGen = fc
        .constantFrom(...ALLOWED_FILE_EXTENSIONS)
        .chain((ext) =>
          fc.array(fc.boolean(), { minLength: ext.length, maxLength: ext.length }).map((cases) =>
            ext
              .split('')
              .map((char, i) => (cases[i] ? char.toUpperCase() : char.toLowerCase()))
              .join(''),
          ),
        );

      // Generator for valid MIME types
      const mimeTypeGen = fc.constantFrom(
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
      );

      // Generator for valid files
      const validFileGen = fc.record({
        basename: fc
          .string({ minLength: 1, maxLength: 50 })
          .filter((s) => {
            // Filter out empty strings and strings with only whitespace
            if (s.trim() === '') return false;
            // Filter out strings with path separators or other problematic characters
            if (s.includes('/') || s.includes('\\') || s.includes('\0')) return false;
            return true;
          }),
        extension: validExtensionGen,
        size: fc.integer({ min: 1, max: MAX_FILE_SIZE }),
        mimeType: mimeTypeGen,
      });

      await fc.assert(
        fc.asyncProperty(validFileGen, async (fileSpec) => {
          // Clear mocks for this iteration
          vi.clearAllMocks();

          // Re-setup mocks for this iteration
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
          }));

          vi.mocked(prisma.documentAuditLog.create).mockResolvedValue({} as any);

          // Create a File object with valid extension and size
          const filename = `${fileSpec.basename}.${fileSpec.extension}`;
          const content = new Uint8Array(fileSpec.size);
          // Fill with some random data to make it realistic
          for (let i = 0; i < Math.min(fileSpec.size, 100); i++) {
            content[i] = Math.floor(Math.random() * 256);
          }

          const file = new File([content], filename, {
            type: fileSpec.mimeType,
          });

          // Upload the file
          const result = await uploadFileAttachment({
            file,
            envelopeId: TEST_ENVELOPE_ID,
            userId: TEST_USER_ID,
          });

          // Verify the result contains expected fields
          expect(result.id).toBeDefined();
          expect(result.storageKey).toBeDefined();
          expect(result.hash).toBeDefined();
          expect(result.hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
          expect(result.fileSize).toBe(fileSpec.size);
          expect(result.contentType).toBe(fileSpec.mimeType);

          // Verify envelope.findUnique was called to check envelope exists
          expect(prisma.envelope.findUnique).toHaveBeenCalledWith({
            where: { id: TEST_ENVELOPE_ID },
            select: { id: true },
          });

          // Verify envelopeAttachment.create was called with correct data
          expect(prisma.envelopeAttachment.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                type: 'file',
                label: filename,
                fileSize: fileSpec.size,
                contentType: fileSpec.mimeType,
                hash: result.hash,
                envelopeId: TEST_ENVELOPE_ID,
              }),
            }),
          );

          // Verify audit log was created
          expect(prisma.documentAuditLog.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                type: 'FILE_ATTACHMENT_UPLOADED',
                envelopeId: TEST_ENVELOPE_ID,
                data: expect.objectContaining({
                  attachmentId: result.id,
                  filename: filename,
                  fileSize: fileSpec.size,
                  contentType: fileSpec.mimeType,
                  hash: result.hash,
                }),
              }),
            }),
          );
        }),
        { numRuns: 100 },
      );
    });

    it('should handle files at the maximum size boundary', async () => {
      // Generator for files exactly at max size
      const maxSizeFileGen = fc.record({
        basename: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim() !== ''),
        extension: fc.constantFrom(...ALLOWED_FILE_EXTENSIONS),
      });

      await fc.assert(
        fc.asyncProperty(maxSizeFileGen, async (fileSpec) => {
          const filename = `${fileSpec.basename}.${fileSpec.extension}`;
          const content = new Uint8Array(MAX_FILE_SIZE);
          const file = new File([content], filename, {
            type: 'application/octet-stream',
          });

          const result = await uploadFileAttachment({
            file,
            envelopeId: TEST_ENVELOPE_ID,
            userId: TEST_USER_ID,
          });

          // Verify file was accepted
          expect(result.id).toBeDefined();
          expect(result.fileSize).toBe(MAX_FILE_SIZE);

          // Verify database record was created
          expect(prisma.envelopeAttachment.create).toHaveBeenCalled();
        }),
        { numRuns: 50 },
      );
    });

    it('should generate unique hashes for different file contents', async () => {
      // Generator for files with same name but different content
      const fileGen = fc.record({
        basename: fc.constant('test-file'),
        extension: fc.constant('pdf'),
        content1: fc.uint8Array({ minLength: 100, maxLength: 1000 }),
        content2: fc.uint8Array({ minLength: 100, maxLength: 1000 }),
      });

      await fc.assert(
        fc.asyncProperty(fileGen, async (fileSpec) => {
          // Skip if contents are identical
          if (
            fileSpec.content1.length === fileSpec.content2.length &&
            fileSpec.content1.every((val, idx) => val === fileSpec.content2[idx])
          ) {
            return;
          }

          const filename = `${fileSpec.basename}.${fileSpec.extension}`;

          // Upload first file
          const file1 = new File([fileSpec.content1], filename, {
            type: 'application/pdf',
          });
          const result1 = await uploadFileAttachment({
            file: file1,
            envelopeId: TEST_ENVELOPE_ID,
            userId: TEST_USER_ID,
          });

          // Upload second file with same name but different content
          const file2 = new File([fileSpec.content2], filename, {
            type: 'application/pdf',
          });
          const result2 = await uploadFileAttachment({
            file: file2,
            envelopeId: TEST_ENVELOPE_ID,
            userId: TEST_USER_ID,
          });

          // Verify hashes are different for different contents
          expect(result1.hash).not.toBe(result2.hash);
          expect(result1.hash).toMatch(/^[a-f0-9]{64}$/);
          expect(result2.hash).toMatch(/^[a-f0-9]{64}$/);
        }),
        { numRuns: 50 },
      );
    });
  });

  /**
   * Property 5: Metadata Storage Completeness
   * **Validates: Requirements 2.4**
   *
   * For any uploaded file attachment, the database record should contain
   * all required metadata: upload timestamp, filename (in label), file size,
   * content type, and hash.
   */
  describe('Property 5: Metadata Storage Completeness', () => {
    it('should store all required metadata fields for any uploaded file', async () => {
      // Generator for valid file extensions
      const validExtensionGen = fc.constantFrom(...ALLOWED_FILE_EXTENSIONS);

      // Generator for valid MIME types
      const mimeTypeGen = fc.constantFrom(
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
      );

      // Generator for valid files with various characteristics
      const validFileGen = fc.record({
        basename: fc
          .string({ minLength: 1, maxLength: 100 })
          .filter((s) => {
            if (s.trim() === '') return false;
            if (s.includes('/') || s.includes('\\') || s.includes('\0')) return false;
            return true;
          }),
        extension: validExtensionGen,
        size: fc.integer({ min: 1, max: MAX_FILE_SIZE }),
        mimeType: mimeTypeGen,
      });

      await fc.assert(
        fc.asyncProperty(validFileGen, async (fileSpec) => {
          // Clear mocks for this iteration
          vi.clearAllMocks();

          // Track the data passed to prisma.envelopeAttachment.create
          let capturedCreateData: any = null;

          // Re-setup mocks for this iteration
          vi.mocked(prisma.envelope.findUnique).mockResolvedValue({
            id: TEST_ENVELOPE_ID,
          } as any);

          vi.mocked(prisma.envelopeAttachment.create).mockImplementation(async (args: any) => {
            capturedCreateData = args.data;
            return {
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
            };
          });

          vi.mocked(prisma.documentAuditLog.create).mockResolvedValue({} as any);

          // Create a File object
          const filename = `${fileSpec.basename}.${fileSpec.extension}`;
          const content = new Uint8Array(fileSpec.size);
          // Fill with some random data
          for (let i = 0; i < Math.min(fileSpec.size, 100); i++) {
            content[i] = Math.floor(Math.random() * 256);
          }

          const file = new File([content], filename, {
            type: fileSpec.mimeType,
          });

          // Record the time before upload
          const beforeUpload = new Date();

          // Upload the file
          const result = await uploadFileAttachment({
            file,
            envelopeId: TEST_ENVELOPE_ID,
            userId: TEST_USER_ID,
          });

          // Verify that prisma.envelopeAttachment.create was called
          expect(prisma.envelopeAttachment.create).toHaveBeenCalled();
          expect(capturedCreateData).not.toBeNull();

          // Verify all required metadata fields are present and populated
          // 1. Upload timestamp - verified by checking createdAt is set (handled by database default)
          //    We verify the create call was made, which triggers the database default
          expect(capturedCreateData).toBeDefined();

          // 2. Filename (stored in label field)
          expect(capturedCreateData.label).toBe(filename);
          expect(capturedCreateData.label).toBe(file.name);

          // 3. File size
          expect(capturedCreateData.fileSize).toBe(fileSpec.size);
          expect(capturedCreateData.fileSize).toBe(file.size);
          expect(typeof capturedCreateData.fileSize).toBe('number');
          expect(capturedCreateData.fileSize).toBeGreaterThan(0);
          expect(capturedCreateData.fileSize).toBeLessThanOrEqual(MAX_FILE_SIZE);

          // 4. Content type (MIME type)
          expect(capturedCreateData.contentType).toBe(fileSpec.mimeType);
          expect(capturedCreateData.contentType).toBe(file.type);
          expect(typeof capturedCreateData.contentType).toBe('string');
          expect(capturedCreateData.contentType.length).toBeGreaterThan(0);

          // 5. Hash (SHA-256)
          expect(capturedCreateData.hash).toBeDefined();
          expect(typeof capturedCreateData.hash).toBe('string');
          expect(capturedCreateData.hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
          expect(capturedCreateData.hash).toBe(result.hash);

          // Additional verification: ensure type is 'file'
          expect(capturedCreateData.type).toBe('file');

          // Additional verification: ensure envelope association
          expect(capturedCreateData.envelopeId).toBe(TEST_ENVELOPE_ID);

          // Additional verification: ensure storage key is present
          expect(capturedCreateData.data).toBeDefined();
          expect(typeof capturedCreateData.data).toBe('string');
          expect(capturedCreateData.data.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });

    it('should store complete metadata for files at size boundaries', async () => {
      // Test files at minimum and maximum size boundaries
      const boundarySizeGen = fc.constantFrom(
        1, // Minimum size
        100, // Small file
        1024, // 1KB
        1024 * 1024, // 1MB
        5 * 1024 * 1024, // 5MB
        MAX_FILE_SIZE, // Maximum size
      );

      const boundaryFileGen = fc.record({
        basename: fc.constant('boundary-test'),
        extension: fc.constantFrom(...ALLOWED_FILE_EXTENSIONS),
        size: boundarySizeGen,
        mimeType: fc.constantFrom('application/pdf', 'image/png', 'text/plain'),
      });

      await fc.assert(
        fc.asyncProperty(boundaryFileGen, async (fileSpec) => {
          vi.clearAllMocks();

          let capturedCreateData: any = null;

          vi.mocked(prisma.envelope.findUnique).mockResolvedValue({
            id: TEST_ENVELOPE_ID,
          } as any);

          vi.mocked(prisma.envelopeAttachment.create).mockImplementation(async (args: any) => {
            capturedCreateData = args.data;
            return {
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
            };
          });

          vi.mocked(prisma.documentAuditLog.create).mockResolvedValue({} as any);

          const filename = `${fileSpec.basename}.${fileSpec.extension}`;
          const content = new Uint8Array(fileSpec.size);
          const file = new File([content], filename, {
            type: fileSpec.mimeType,
          });

          await uploadFileAttachment({
            file,
            envelopeId: TEST_ENVELOPE_ID,
            userId: TEST_USER_ID,
          });

          // Verify all metadata fields are present even at boundary sizes
          expect(capturedCreateData.label).toBe(filename);
          expect(capturedCreateData.fileSize).toBe(fileSpec.size);
          expect(capturedCreateData.contentType).toBe(fileSpec.mimeType);
          expect(capturedCreateData.hash).toMatch(/^[a-f0-9]{64}$/);
          expect(capturedCreateData.type).toBe('file');
          expect(capturedCreateData.envelopeId).toBe(TEST_ENVELOPE_ID);
          expect(capturedCreateData.data).toBeDefined();
        }),
        { numRuns: 50 },
      );
    });

    it('should store unique hashes for different file contents with same metadata', async () => {
      // Test that files with same name, size, and type but different content
      // get different hashes stored
      const sameMetadataFileGen = fc.record({
        basename: fc.constant('same-metadata'),
        extension: fc.constant('pdf'),
        size: fc.constant(1000),
        mimeType: fc.constant('application/pdf'),
        content1: fc.uint8Array({ minLength: 1000, maxLength: 1000 }),
        content2: fc.uint8Array({ minLength: 1000, maxLength: 1000 }),
      });

      await fc.assert(
        fc.asyncProperty(sameMetadataFileGen, async (fileSpec) => {
          // Skip if contents are identical
          if (fileSpec.content1.every((val, idx) => val === fileSpec.content2[idx])) {
            return;
          }

          vi.clearAllMocks();

          let capturedCreateData1: any = null;
          let capturedCreateData2: any = null;
          let callCount = 0;

          vi.mocked(prisma.envelope.findUnique).mockResolvedValue({
            id: TEST_ENVELOPE_ID,
          } as any);

          vi.mocked(prisma.envelopeAttachment.create).mockImplementation(async (args: any) => {
            if (callCount === 0) {
              capturedCreateData1 = args.data;
            } else {
              capturedCreateData2 = args.data;
            }
            callCount++;

            return {
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
            };
          });

          vi.mocked(prisma.documentAuditLog.create).mockResolvedValue({} as any);

          const filename = `${fileSpec.basename}.${fileSpec.extension}`;

          // Upload first file
          const file1 = new File([fileSpec.content1], filename, {
            type: fileSpec.mimeType,
          });
          await uploadFileAttachment({
            file: file1,
            envelopeId: TEST_ENVELOPE_ID,
            userId: TEST_USER_ID,
          });

          // Upload second file
          const file2 = new File([fileSpec.content2], filename, {
            type: fileSpec.mimeType,
          });
          await uploadFileAttachment({
            file: file2,
            envelopeId: TEST_ENVELOPE_ID,
            userId: TEST_USER_ID,
          });

          // Verify both have all metadata fields
          expect(capturedCreateData1.label).toBe(filename);
          expect(capturedCreateData1.fileSize).toBe(fileSpec.size);
          expect(capturedCreateData1.contentType).toBe(fileSpec.mimeType);
          expect(capturedCreateData1.hash).toMatch(/^[a-f0-9]{64}$/);

          expect(capturedCreateData2.label).toBe(filename);
          expect(capturedCreateData2.fileSize).toBe(fileSpec.size);
          expect(capturedCreateData2.contentType).toBe(fileSpec.mimeType);
          expect(capturedCreateData2.hash).toMatch(/^[a-f0-9]{64}$/);

          // Verify hashes are different (proving hash is based on content, not metadata)
          expect(capturedCreateData1.hash).not.toBe(capturedCreateData2.hash);
        }),
        { numRuns: 50 },
      );
    });
  });
});
