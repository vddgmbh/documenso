import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';

import { prisma } from '@documenso/prisma';

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
 * Property-Based Tests for Access Control
 * Feature: document-file-attachments
 */
describe('check-attachment-access - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 6: Access Control Authorization
   * **Validates: Requirements 3.1, 3.2, 3.3**
   *
   * For any file attachment and user, the user should be able to download
   * the attachment if and only if they are either the envelope owner or
   * a recipient of the envelope.
   */
  describe('Property 6: Access Control Authorization', () => {
    // Generator for user IDs (positive integers)
    const userIdGen = fc.integer({ min: 1, max: 10000 });

    // Generator for attachment IDs (UUIDs or CUIDs)
    const attachmentIdGen = fc.uuid();

    // Generator for envelope IDs
    const envelopeIdGen = fc.uuid();

    // Generator for recipient tokens
    const tokenGen = fc.string({ minLength: 10, maxLength: 50 });

    // Generator for email addresses
    const emailGen = fc
      .tuple(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes('@')),
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes('@')),
      )
      .map(([local, domain]) => `${local}@${domain}.com`);

    // Generator for recipient objects
    const recipientGen = fc.record({
      id: fc.integer({ min: 1, max: 10000 }),
      email: emailGen,
      token: tokenGen,
    });

    it('should grant access to envelope owner', async () => {
      await fc.assert(
        fc.asyncProperty(
          attachmentIdGen,
          envelopeIdGen,
          userIdGen,
          emailGen,
          fc.array(recipientGen, { minLength: 0, maxLength: 5 }),
          async (attachmentId, envelopeId, ownerId, ownerEmail, recipients) => {
            // Clear mocks for this iteration
            vi.clearAllMocks();

            // Setup mock: attachment exists with this owner
            vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
              id: attachmentId,
              type: 'file',
              label: 'test.pdf',
              data: 'storage-key',
              fileSize: 1024,
              contentType: 'application/pdf',
              hash: 'test-hash',
              envelopeId: envelopeId,
              createdAt: new Date(),
              updatedAt: new Date(),
              envelope: {
                id: envelopeId,
                userId: ownerId,
                recipients: recipients,
                user: {
                  id: ownerId,
                  email: ownerEmail,
                },
              },
            } as any);

            // Check access as owner
            const hasAccess = await checkAttachmentAccess({
              attachmentId,
              userId: ownerId,
            });

            // Owner should always have access
            expect(hasAccess).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should grant access to envelope recipients', async () => {
      await fc.assert(
        fc.asyncProperty(
          attachmentIdGen,
          envelopeIdGen,
          userIdGen,
          emailGen,
          userIdGen,
          emailGen,
          fc.array(recipientGen, { minLength: 0, maxLength: 3 }),
          async (
            attachmentId,
            envelopeId,
            ownerId,
            ownerEmail,
            recipientUserId,
            recipientEmail,
            otherRecipients,
          ) => {
            // Ensure recipient is not the owner
            if (recipientUserId === ownerId) {
              return;
            }

            // Ensure recipient email is unique
            if (
              recipientEmail.toLowerCase() === ownerEmail.toLowerCase() ||
              otherRecipients.some((r) => r.email.toLowerCase() === recipientEmail.toLowerCase())
            ) {
              return;
            }

            // Clear mocks for this iteration
            vi.clearAllMocks();

            // Create recipient object
            const recipient = {
              id: 999,
              email: recipientEmail,
              token: 'recipient-token',
            };

            // Setup mock: attachment exists with this recipient
            vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
              id: attachmentId,
              type: 'file',
              label: 'test.pdf',
              data: 'storage-key',
              fileSize: 1024,
              contentType: 'application/pdf',
              hash: 'test-hash',
              envelopeId: envelopeId,
              createdAt: new Date(),
              updatedAt: new Date(),
              envelope: {
                id: envelopeId,
                userId: ownerId,
                recipients: [recipient, ...otherRecipients],
                user: {
                  id: ownerId,
                  email: ownerEmail,
                },
              },
            } as any);

            // Mock user lookup for recipient
            vi.mocked(prisma.user.findUnique).mockResolvedValue({
              id: recipientUserId,
              email: recipientEmail,
            } as any);

            // Check access as recipient
            const hasAccess = await checkAttachmentAccess({
              attachmentId,
              userId: recipientUserId,
            });

            // Recipient should have access
            expect(hasAccess).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should deny access to non-recipients', async () => {
      await fc.assert(
        fc.asyncProperty(
          attachmentIdGen,
          envelopeIdGen,
          userIdGen,
          emailGen,
          userIdGen,
          emailGen,
          fc.array(recipientGen, { minLength: 0, maxLength: 5 }),
          async (
            attachmentId,
            envelopeId,
            ownerId,
            ownerEmail,
            nonRecipientUserId,
            nonRecipientEmail,
            recipients,
          ) => {
            // Ensure non-recipient is not the owner
            if (nonRecipientUserId === ownerId) {
              return;
            }

            // Ensure non-recipient email is not in recipients list
            if (
              nonRecipientEmail.toLowerCase() === ownerEmail.toLowerCase() ||
              recipients.some((r) => r.email.toLowerCase() === nonRecipientEmail.toLowerCase())
            ) {
              return;
            }

            // Clear mocks for this iteration
            vi.clearAllMocks();

            // Setup mock: attachment exists but user is not a recipient
            vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
              id: attachmentId,
              type: 'file',
              label: 'test.pdf',
              data: 'storage-key',
              fileSize: 1024,
              contentType: 'application/pdf',
              hash: 'test-hash',
              envelopeId: envelopeId,
              createdAt: new Date(),
              updatedAt: new Date(),
              envelope: {
                id: envelopeId,
                userId: ownerId,
                recipients: recipients,
                user: {
                  id: ownerId,
                  email: ownerEmail,
                },
              },
            } as any);

            // Mock user lookup for non-recipient
            vi.mocked(prisma.user.findUnique).mockResolvedValue({
              id: nonRecipientUserId,
              email: nonRecipientEmail,
            } as any);

            // Check access as non-recipient
            const hasAccess = await checkAttachmentAccess({
              attachmentId,
              userId: nonRecipientUserId,
            });

            // Non-recipient should NOT have access
            expect(hasAccess).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should grant access with valid recipient token', async () => {
      await fc.assert(
        fc.asyncProperty(
          attachmentIdGen,
          envelopeIdGen,
          userIdGen,
          emailGen,
          tokenGen,
          fc.array(recipientGen, { minLength: 0, maxLength: 5 }),
          async (attachmentId, envelopeId, ownerId, ownerEmail, validToken, otherRecipients) => {
            // Ensure token is unique
            if (otherRecipients.some((r) => r.token === validToken)) {
              return;
            }

            // Clear mocks for this iteration
            vi.clearAllMocks();

            // Create recipient with this token
            const recipient = {
              id: 999,
              email: 'recipient@test.com',
              token: validToken,
            };

            // Setup mock: attachment exists with this recipient token
            vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
              id: attachmentId,
              type: 'file',
              label: 'test.pdf',
              data: 'storage-key',
              fileSize: 1024,
              contentType: 'application/pdf',
              hash: 'test-hash',
              envelopeId: envelopeId,
              createdAt: new Date(),
              updatedAt: new Date(),
              envelope: {
                id: envelopeId,
                userId: ownerId,
                recipients: [recipient, ...otherRecipients],
                user: {
                  id: ownerId,
                  email: ownerEmail,
                },
              },
            } as any);

            // Check access with valid token
            const hasAccess = await checkAttachmentAccess({
              attachmentId,
              recipientToken: validToken,
            });

            // Valid token should grant access
            expect(hasAccess).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should deny access with invalid recipient token', async () => {
      await fc.assert(
        fc.asyncProperty(
          attachmentIdGen,
          envelopeIdGen,
          userIdGen,
          emailGen,
          tokenGen,
          fc.array(recipientGen, { minLength: 0, maxLength: 5 }),
          async (attachmentId, envelopeId, ownerId, ownerEmail, invalidToken, recipients) => {
            // Ensure invalid token is not in recipients list
            if (recipients.some((r) => r.token === invalidToken)) {
              return;
            }

            // Clear mocks for this iteration
            vi.clearAllMocks();

            // Setup mock: attachment exists but token is not valid
            vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
              id: attachmentId,
              type: 'file',
              label: 'test.pdf',
              data: 'storage-key',
              fileSize: 1024,
              contentType: 'application/pdf',
              hash: 'test-hash',
              envelopeId: envelopeId,
              createdAt: new Date(),
              updatedAt: new Date(),
              envelope: {
                id: envelopeId,
                userId: ownerId,
                recipients: recipients,
                user: {
                  id: ownerId,
                  email: ownerEmail,
                },
              },
            } as any);

            // Check access with invalid token
            const hasAccess = await checkAttachmentAccess({
              attachmentId,
              recipientToken: invalidToken,
            });

            // Invalid token should NOT grant access
            expect(hasAccess).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle case-insensitive email matching for recipients', async () => {
      await fc.assert(
        fc.asyncProperty(
          attachmentIdGen,
          envelopeIdGen,
          userIdGen,
          emailGen,
          userIdGen,
          fc.array(recipientGen, { minLength: 0, maxLength: 3 }),
          async (
            attachmentId,
            envelopeId,
            ownerId,
            ownerEmail,
            recipientUserId,
            otherRecipients,
          ) => {
            // Ensure recipient is not the owner
            if (recipientUserId === ownerId) {
              return;
            }

            // Generate an email with mixed case
            const baseEmail = 'TestUser@Example.COM';
            const recipientEmailInEnvelope = baseEmail;
            const recipientEmailInUser = baseEmail.toLowerCase();

            // Ensure no conflicts with other recipients
            if (
              otherRecipients.some(
                (r) => r.email.toLowerCase() === recipientEmailInEnvelope.toLowerCase(),
              )
            ) {
              return;
            }

            // Clear mocks for this iteration
            vi.clearAllMocks();

            // Create recipient with uppercase email
            const recipient = {
              id: 999,
              email: recipientEmailInEnvelope,
              token: 'recipient-token',
            };

            // Setup mock: attachment exists with recipient having uppercase email
            vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
              id: attachmentId,
              type: 'file',
              label: 'test.pdf',
              data: 'storage-key',
              fileSize: 1024,
              contentType: 'application/pdf',
              hash: 'test-hash',
              envelopeId: envelopeId,
              createdAt: new Date(),
              updatedAt: new Date(),
              envelope: {
                id: envelopeId,
                userId: ownerId,
                recipients: [recipient, ...otherRecipients],
                user: {
                  id: ownerId,
                  email: ownerEmail,
                },
              },
            } as any);

            // Mock user lookup with lowercase email
            vi.mocked(prisma.user.findUnique).mockResolvedValue({
              id: recipientUserId,
              email: recipientEmailInUser,
            } as any);

            // Check access - should match despite case difference
            const hasAccess = await checkAttachmentAccess({
              attachmentId,
              userId: recipientUserId,
            });

            // Should have access due to case-insensitive matching
            expect(hasAccess).toBe(true);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should verify access control across multiple envelopes and users', async () => {
      // Generator for a complete scenario with multiple envelopes and users
      const scenarioGen = fc.record({
        attachmentId: attachmentIdGen,
        envelopeId: envelopeIdGen,
        ownerId: userIdGen,
        ownerEmail: emailGen,
        recipients: fc.array(recipientGen, { minLength: 1, maxLength: 5 }),
        testUserId: userIdGen,
        testUserEmail: emailGen,
      });

      await fc.assert(
        fc.asyncProperty(scenarioGen, async (scenario) => {
          // Clear mocks for this iteration
          vi.clearAllMocks();

          // Setup mock
          vi.mocked(prisma.envelopeAttachment.findUnique).mockResolvedValue({
            id: scenario.attachmentId,
            type: 'file',
            label: 'test.pdf',
            data: 'storage-key',
            fileSize: 1024,
            contentType: 'application/pdf',
            hash: 'test-hash',
            envelopeId: scenario.envelopeId,
            createdAt: new Date(),
            updatedAt: new Date(),
            envelope: {
              id: scenario.envelopeId,
              userId: scenario.ownerId,
              recipients: scenario.recipients,
              user: {
                id: scenario.ownerId,
                email: scenario.ownerEmail,
              },
            },
          } as any);

          vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: scenario.testUserId,
            email: scenario.testUserEmail,
          } as any);

          // Check access
          const hasAccess = await checkAttachmentAccess({
            attachmentId: scenario.attachmentId,
            userId: scenario.testUserId,
          });

          // Determine expected access
          const isOwner = scenario.testUserId === scenario.ownerId;
          const isRecipient = scenario.recipients.some(
            (r) => r.email.toLowerCase() === scenario.testUserEmail.toLowerCase(),
          );
          const expectedAccess = isOwner || isRecipient;

          // Verify access matches expectation
          expect(hasAccess).toBe(expectedAccess);
        }),
        { numRuns: 100 },
      );
    });
  });
});
