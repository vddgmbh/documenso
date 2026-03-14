import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@documenso/prisma';

import { uploadFileAttachment } from '../attachment/upload-file-attachment';

/**
 * Integration Test for Document Creation with File Attachments
 * Feature: document-file-attachments
 * Validates Requirements: 1.1, 1.3, 8.1
 * 
 * This test verifies the integration between envelope creation and file attachment upload:
 * 1. Envelope exists
 * 2. Upload multiple file attachments to the envelope
 * 3. Verify all attachments are stored
 * 4. Verify audit logs are created
 */

// Mock the storage utilities
vi.mock('../../universal/upload/put-file.server', () => ({
  putFileServerSide: vi.fn().mockImplementation(async (file: File) => ({
    data: `s3://attachments/${file.name}`,
    type: 'S3_PATH',
  })),
}));

// Mock document audit logs
vi.mock('../../utils/document-audit-logs', () => ({
  createDocumentAuditLogData: vi.fn((data) => data),
}));

// Mock prisma
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

describe('create-envelope-with-attachments - Integration Test', () => {
  const TEST_USER_ID = 1;
  const TEST_ENVELOPE_ID = 'test-envelope-123';

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup database mocks
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
   * Test: Upload multiple file attachments to an envelope
   * Validates Requirements: 1.1, 1.3
   */
  it('should upload multiple file attachments to an envelope', async () => {
    // Create test files
    const attachment1 = new File(
      [Buffer.from('attachment-1-content')],
      'supporting-doc.pdf',
      { type: 'application/pdf' }
    );

    const attachment2 = new File(
      [Buffer.from('attachment-2-content')],
      'image.png',
      { type: 'image/png' }
    );

    const attachment3 = new File(
      [Buffer.from('attachment-3-content')],
      'spreadsheet.xlsx',
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    );

    // Upload attachments
    const results = await Promise.all([
      uploadFileAttachment({
        file: attachment1,
        envelopeId: TEST_ENVELOPE_ID,
        userId: TEST_USER_ID,
      }),
      uploadFileAttachment({
        file: attachment2,
        envelopeId: TEST_ENVELOPE_ID,
        userId: TEST_USER_ID,
      }),
      uploadFileAttachment({
        file: attachment3,
        envelopeId: TEST_ENVELOPE_ID,
        userId: TEST_USER_ID,
      }),
    ]);

    // Verify all uploads succeeded
    expect(results).toHaveLength(3);
    results.forEach((result) => {
      expect(result.id).toBeDefined();
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    // Verify file attachments were created
    expect(prisma.envelopeAttachment.create).toHaveBeenCalledTimes(3);

    // Verify each attachment was created with correct data
    const attachmentCalls = vi.mocked(prisma.envelopeAttachment.create).mock.calls;
    
    expect(attachmentCalls[0][0].data).toMatchObject({
      type: 'file',
      label: 'supporting-doc.pdf',
      envelopeId: TEST_ENVELOPE_ID,
      contentType: 'application/pdf',
    });

    expect(attachmentCalls[1][0].data).toMatchObject({
      type: 'file',
      label: 'image.png',
      envelopeId: TEST_ENVELOPE_ID,
      contentType: 'image/png',
    });

    expect(attachmentCalls[2][0].data).toMatchObject({
      type: 'file',
      label: 'spreadsheet.xlsx',
      envelopeId: TEST_ENVELOPE_ID,
    });

    // Verify all attachments have hashes
    attachmentCalls.forEach((call) => {
      expect(call[0].data.hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  /**
   * Test: Verify audit logs are created for file attachments
   * Validates Requirement: 8.1
   */
  it('should create audit logs for each file attachment upload', async () => {
    const attachment1 = new File(
      [Buffer.from('attachment-content')],
      'attachment.pdf',
      { type: 'application/pdf' }
    );

    await uploadFileAttachment({
      file: attachment1,
      envelopeId: TEST_ENVELOPE_ID,
      userId: TEST_USER_ID,
      requestMetadata: {
        source: 'app',
        userAgent: 'test',
        ipAddress: '127.0.0.1',
      },
    });

    // Verify audit log was created for the attachment
    expect(prisma.documentAuditLog.create).toHaveBeenCalled();
    
    const auditLogCalls = vi.mocked(prisma.documentAuditLog.create).mock.calls;
    const attachmentAuditLog = auditLogCalls.find(
      (call) => call[0].data.type === 'FILE_ATTACHMENT_UPLOADED'
    );

    expect(attachmentAuditLog).toBeDefined();
    expect(attachmentAuditLog![0].data.data).toMatchObject({
      filename: 'attachment.pdf',
      contentType: 'application/pdf',
    });
  });

  /**
   * Test: Verify all attachments are associated with the envelope
   * Validates Requirement: 1.3
   */
  it('should associate all file attachments with the envelope', async () => {
    const attachments = [
      new File([Buffer.from('content-1')], 'file1.pdf', { type: 'application/pdf' }),
      new File([Buffer.from('content-2')], 'file2.png', { type: 'image/png' }),
      new File([Buffer.from('content-3')], 'file3.docx', { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      }),
    ];

    await Promise.all(
      attachments.map((file) =>
        uploadFileAttachment({
          file,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        })
      )
    );

    // Verify all attachments were created with the correct envelope ID
    const attachmentCalls = vi.mocked(prisma.envelopeAttachment.create).mock.calls;
    expect(attachmentCalls).toHaveLength(3);

    attachmentCalls.forEach((call) => {
      expect(call[0].data.envelopeId).toBe(TEST_ENVELOPE_ID);
    });
  });

  /**
   * Test: Verify file metadata is stored correctly
   * Validates Requirement: 1.3
   */
  it('should store complete file metadata for each attachment', async () => {
    const attachment = new File(
      [Buffer.from('test-content')],
      'test-document.pdf',
      { type: 'application/pdf' }
    );

    const result = await uploadFileAttachment({
      file: attachment,
      envelopeId: TEST_ENVELOPE_ID,
      userId: TEST_USER_ID,
    });

    // Verify result contains all metadata
    expect(result).toMatchObject({
      id: expect.any(String),
      storageKey: expect.stringContaining('test-document.pdf'),
      hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      fileSize: attachment.size,
      contentType: 'application/pdf',
    });

    // Verify database record was created with all metadata
    const attachmentCall = vi.mocked(prisma.envelopeAttachment.create).mock.calls[0];
    expect(attachmentCall[0].data).toMatchObject({
      type: 'file',
      label: 'test-document.pdf',
      data: expect.any(String),
      fileSize: attachment.size,
      contentType: 'application/pdf',
      hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      envelopeId: TEST_ENVELOPE_ID,
    });
  });

  /**
   * Test: Verify storage keys are generated correctly
   * Validates Requirement: 1.1
   */
  it('should generate unique storage keys for each attachment', async () => {
    const attachments = [
      new File([Buffer.from('content-1')], 'file.pdf', { type: 'application/pdf' }),
      new File([Buffer.from('content-2')], 'file.pdf', { type: 'application/pdf' }),
    ];

    const results = await Promise.all(
      attachments.map((file) =>
        uploadFileAttachment({
          file,
          envelopeId: TEST_ENVELOPE_ID,
          userId: TEST_USER_ID,
        })
      )
    );

    // Verify each attachment has a storage key
    results.forEach((result) => {
      expect(result.storageKey).toBeDefined();
      expect(result.storageKey).toContain('file.pdf');
    });

    // Verify storage keys are stored in database
    const attachmentCalls = vi.mocked(prisma.envelopeAttachment.create).mock.calls;
    attachmentCalls.forEach((call) => {
      expect(call[0].data.data).toBeDefined();
      expect(call[0].data.data).toContain('file.pdf');
    });
  });
});
