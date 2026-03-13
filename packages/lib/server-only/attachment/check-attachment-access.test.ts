import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@documenso/prisma';

import { AppError } from '../../errors/app-error';
import { checkAttachmentAccess } from './check-attachment-access';

// Mock the prisma client
vi.mock('@documenso/prisma', () => ({
  prisma: {
    envelopeAttachment: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

/**
 * Unit Tests for Access Control
 * Feature: document-file-attachments
 * Validates Requirements: 3.1, 3.2, 3.3
 */
describe('checkAttachmentAccess', () => {
  const TEST_ATTACHMENT_ID = 'test-attachment-123';
  const OWNER_ID = 1;
  const RECIPIENT_ID = 2;
  const NON_RECIPIENT_ID = 3;
  const RECIPIENT_EMAIL = 'recipient@test.com';
  const NON_RECIPIENT_EMAIL = 'non-recipient@test.com';
  const RECIPIENT_TOKEN = 'valid-token-123';
  const INVALID_TOKEN = 'invalid-token-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: Neither userId nor recipientToken provided
   * Validates Requirement 3.1: Access control must verify user authorization
   */
  it('should throw error if neither userId nor recipientToken provided', async () => {
    await expect(
      checkAttachmentAccess({
        attachmentId: TEST_ATTACHMENT_ID,
      }),
    ).rejects.toThrow(AppError);

    await expect(
      checkAttachmentAccess({
        attachmentId: TEST_ATTACHMENT_ID,
      }),
    ).rejects.toThrow('INVALID_REQUEST');
  });

  /**
   * Test: Attachment not found
   * Validates Requirement 3.1: System must validate attachment exists
   */
  it('should throw error if attachment not found', async () => {
    vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValueOnce(null);

    await expect(
      checkAttachmentAccess({
        attachmentId: 'non-existent-id',
        userId: OWNER_ID,
      }),
    ).rejects.toThrow(AppError);

    await expect(
      checkAttachmentAccess({
        attachmentId: 'non-existent-id',
        userId: OWNER_ID,
      }),
    ).rejects.toThrow('ATTACHMENT_NOT_FOUND');
  });

  /**
   * Test: Owner can access
   * Validates Requirement 3.3: Envelope owner is an authorized user
   */
  it('should grant access to envelope owner', async () => {
    vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValueOnce({
      id: TEST_ATTACHMENT_ID,
      type: 'file',
      label: 'test.pdf',
      data: 'storage-key',
      fileSize: 1024,
      contentType: 'application/pdf',
      hash: 'test-hash',
      envelopeId: 'envelope-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      envelope: {
        id: 'envelope-123',
        userId: OWNER_ID,
        recipients: [],
        user: {
          id: OWNER_ID,
          email: 'owner@test.com',
        },
      },
    } as any);

    const hasAccess = await checkAttachmentAccess({
      attachmentId: TEST_ATTACHMENT_ID,
      userId: OWNER_ID,
    });

    expect(hasAccess).toBe(true);
  });

  /**
   * Test: Recipient can access by userId
   * Validates Requirement 3.3: Recipients are authorized users
   */
  it('should grant access to recipient by userId', async () => {
    vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValueOnce({
      id: TEST_ATTACHMENT_ID,
      type: 'file',
      label: 'test.pdf',
      data: 'storage-key',
      fileSize: 1024,
      contentType: 'application/pdf',
      hash: 'test-hash',
      envelopeId: 'envelope-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      envelope: {
        id: 'envelope-123',
        userId: OWNER_ID,
        recipients: [
          {
            id: 1,
            email: RECIPIENT_EMAIL,
            token: RECIPIENT_TOKEN,
          },
        ],
        user: {
          id: OWNER_ID,
          email: 'owner@test.com',
        },
      },
    } as any);

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: RECIPIENT_ID,
      email: RECIPIENT_EMAIL,
    } as any);

    const hasAccess = await checkAttachmentAccess({
      attachmentId: TEST_ATTACHMENT_ID,
      userId: RECIPIENT_ID,
    });

    expect(hasAccess).toBe(true);
  });

  /**
   * Test: Non-recipient denied access
   * Validates Requirement 3.2: Unauthorized users are denied access
   */
  it('should deny access to non-recipient', async () => {
    vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValueOnce({
      id: TEST_ATTACHMENT_ID,
      type: 'file',
      label: 'test.pdf',
      data: 'storage-key',
      fileSize: 1024,
      contentType: 'application/pdf',
      hash: 'test-hash',
      envelopeId: 'envelope-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      envelope: {
        id: 'envelope-123',
        userId: OWNER_ID,
        recipients: [
          {
            id: 1,
            email: RECIPIENT_EMAIL,
            token: RECIPIENT_TOKEN,
          },
        ],
        user: {
          id: OWNER_ID,
          email: 'owner@test.com',
        },
      },
    } as any);

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: NON_RECIPIENT_ID,
      email: NON_RECIPIENT_EMAIL,
    } as any);

    const hasAccess = await checkAttachmentAccess({
      attachmentId: TEST_ATTACHMENT_ID,
      userId: NON_RECIPIENT_ID,
    });

    expect(hasAccess).toBe(false);
  });

  /**
   * Test: Valid recipient token grants access
   * Validates Requirement 3.3: Valid recipient tokens grant access
   */
  it('should grant access with valid recipient token', async () => {
    vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValueOnce({
      id: TEST_ATTACHMENT_ID,
      type: 'file',
      label: 'test.pdf',
      data: 'storage-key',
      fileSize: 1024,
      contentType: 'application/pdf',
      hash: 'test-hash',
      envelopeId: 'envelope-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      envelope: {
        id: 'envelope-123',
        userId: OWNER_ID,
        recipients: [
          {
            id: 1,
            email: RECIPIENT_EMAIL,
            token: RECIPIENT_TOKEN,
          },
        ],
        user: {
          id: OWNER_ID,
          email: 'owner@test.com',
        },
      },
    } as any);

    const hasAccess = await checkAttachmentAccess({
      attachmentId: TEST_ATTACHMENT_ID,
      recipientToken: RECIPIENT_TOKEN,
    });

    expect(hasAccess).toBe(true);
  });

  /**
   * Test: Invalid recipient token denies access
   * Validates Requirement 3.2: Invalid tokens are denied access
   */
  it('should deny access with invalid recipient token', async () => {
    vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValueOnce({
      id: TEST_ATTACHMENT_ID,
      type: 'file',
      label: 'test.pdf',
      data: 'storage-key',
      fileSize: 1024,
      contentType: 'application/pdf',
      hash: 'test-hash',
      envelopeId: 'envelope-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      envelope: {
        id: 'envelope-123',
        userId: OWNER_ID,
        recipients: [
          {
            id: 1,
            email: RECIPIENT_EMAIL,
            token: RECIPIENT_TOKEN,
          },
        ],
        user: {
          id: OWNER_ID,
          email: 'owner@test.com',
        },
      },
    } as any);

    const hasAccess = await checkAttachmentAccess({
      attachmentId: TEST_ATTACHMENT_ID,
      recipientToken: INVALID_TOKEN,
    });

    expect(hasAccess).toBe(false);
  });

  /**
   * Test: Both userId and recipientToken valid
   * Validates Requirement 3.3: Multiple authentication methods work
   */
  it('should grant access when both userId and recipientToken are valid', async () => {
    vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValueOnce({
      id: TEST_ATTACHMENT_ID,
      type: 'file',
      label: 'test.pdf',
      data: 'storage-key',
      fileSize: 1024,
      contentType: 'application/pdf',
      hash: 'test-hash',
      envelopeId: 'envelope-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      envelope: {
        id: 'envelope-123',
        userId: OWNER_ID,
        recipients: [
          {
            id: 1,
            email: RECIPIENT_EMAIL,
            token: RECIPIENT_TOKEN,
          },
        ],
        user: {
          id: OWNER_ID,
          email: 'owner@test.com',
        },
      },
    } as any);

    const hasAccess = await checkAttachmentAccess({
      attachmentId: TEST_ATTACHMENT_ID,
      userId: OWNER_ID,
      recipientToken: RECIPIENT_TOKEN,
    });

    expect(hasAccess).toBe(true);
  });

  /**
   * Test: Case-insensitive email matching
   * Validates Requirement 3.3: Email matching is case-insensitive
   */
  it('should handle case-insensitive email matching for recipients', async () => {
    const upperCaseEmail = 'UPPERCASE@TEST.COM';
    const lowerCaseEmail = 'uppercase@test.com';

    vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValueOnce({
      id: TEST_ATTACHMENT_ID,
      type: 'file',
      label: 'test.pdf',
      data: 'storage-key',
      fileSize: 1024,
      contentType: 'application/pdf',
      hash: 'test-hash',
      envelopeId: 'envelope-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      envelope: {
        id: 'envelope-123',
        userId: OWNER_ID,
        recipients: [
          {
            id: 1,
            email: upperCaseEmail,
            token: RECIPIENT_TOKEN,
          },
        ],
        user: {
          id: OWNER_ID,
          email: 'owner@test.com',
        },
      },
    } as any);

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: RECIPIENT_ID,
      email: lowerCaseEmail,
    } as any);

    const hasAccess = await checkAttachmentAccess({
      attachmentId: TEST_ATTACHMENT_ID,
      userId: RECIPIENT_ID,
    });

    expect(hasAccess).toBe(true);
  });
});
