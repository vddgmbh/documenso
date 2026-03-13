import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';

import { prisma } from '@documenso/prisma';

import { findAttachmentsByEnvelopeId } from './find-attachments-by-envelope-id';
import { findAttachmentsByToken } from './find-attachments-by-token';

// Mock the prisma client
vi.mock('@documenso/prisma', () => ({
  prisma: {
    envelope: {
      findFirst: vi.fn(),
    },
    envelopeAttachment: {
      findMany: vi.fn(),
    },
  },
}));

/**
 * Property-Based Tests for Attachment-Envelope Association
 * Feature: document-file-attachments
 */
describe('find-attachments - Association Property Tests', () => {
  const TEST_USER_ID = 1;
  const TEST_TEAM_ID = 1;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 4: Attachment-Envelope Association
   * **Validates: Requirements 2.3**
   *
   * For any file attachment, it should be associated with exactly one envelope,
   * and querying attachments for that envelope should return the attachment.
   */
  describe('Property 4: Attachment-Envelope Association', () => {
    it('should return all attachments associated with an envelope', async () => {
      // Generator for envelope with multiple attachments
      const envelopeWithAttachmentsGen = fc.record({
        envelopeId: fc.uuid(),
        attachments: fc.array(
          fc.record({
            id: fc.uuid(),
            type: fc.constantFrom('file', 'link'),
            label: fc
              .string({ minLength: 1, maxLength: 100 })
              .filter((s) => s.trim() !== ''),
            data: fc.uuid().map((id) => `storage/${id}`),
            fileSize: fc.option(fc.integer({ min: 1, max: 10 * 1024 * 1024 }), { nil: null }),
            contentType: fc.option(
              fc.constantFrom(
                'application/pdf',
                'image/png',
                'image/jpeg',
                'text/plain',
              ),
              { nil: null },
            ),
            hash: fc.option(fc.hexaString({ minLength: 64, maxLength: 64 }), { nil: null }),
          }),
          { minLength: 0, maxLength: 10 },
        ),
      });

      await fc.assert(
        fc.asyncProperty(envelopeWithAttachmentsGen, async (spec) => {
          vi.clearAllMocks();

          // Mock envelope exists
          vi.mocked(prisma.envelope.findFirst).mockResolvedValue({
            id: spec.envelopeId,
            teamId: TEST_TEAM_ID,
          } as any);

          // Mock attachments for this envelope
          const mockAttachments = spec.attachments.map((att) => ({
            id: att.id,
            type: att.type,
            label: att.label,
            data: att.data,
            fileSize: att.fileSize,
            contentType: att.contentType,
            hash: att.hash,
            envelopeId: spec.envelopeId,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

          vi.mocked(prisma.envelopeAttachment.findMany).mockResolvedValue(mockAttachments as any);

          // Query attachments by envelope ID
          const result = await findAttachmentsByEnvelopeId({
            envelopeId: spec.envelopeId,
            userId: TEST_USER_ID,
            teamId: TEST_TEAM_ID,
          });

          // Verify all attachments are returned
          expect(result).toHaveLength(spec.attachments.length);

          // Verify each attachment is associated with the correct envelope
          result.forEach((attachment) => {
            expect(attachment.envelopeId).toBe(spec.envelopeId);
          });

          // Verify all attachment IDs match
          const returnedIds = result.map((att) => att.id).sort();
          const expectedIds = spec.attachments.map((att) => att.id).sort();
          expect(returnedIds).toEqual(expectedIds);

          // Verify findMany was called with correct envelope ID
          expect(prisma.envelopeAttachment.findMany).toHaveBeenCalledWith({
            where: {
              envelopeId: spec.envelopeId,
            },
            orderBy: {
              createdAt: 'asc',
            },
          });
        }),
        { numRuns: 100 },
      );
    });

    it('should return attachments for envelope queried by token', async () => {
      // Generator for envelope with token and attachments
      const envelopeWithTokenGen = fc.record({
        envelopeId: fc.uuid(),
        token: fc.uuid(),
        attachments: fc.array(
          fc.record({
            id: fc.uuid(),
            type: fc.constantFrom('file', 'link'),
            label: fc.string({ minLength: 1, maxLength: 100 }),
            data: fc.uuid(),
          }),
          { minLength: 1, maxLength: 5 },
        ),
      });

      await fc.assert(
        fc.asyncProperty(envelopeWithTokenGen, async (spec) => {
          vi.clearAllMocks();

          // Mock envelope exists with recipient token
          vi.mocked(prisma.envelope.findFirst).mockResolvedValue({
            id: spec.envelopeId,
          } as any);

          // Mock attachments
          const mockAttachments = spec.attachments.map((att) => ({
            id: att.id,
            type: att.type,
            label: att.label,
            data: att.data,
            envelopeId: spec.envelopeId,
            fileSize: null,
            contentType: null,
            hash: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

          vi.mocked(prisma.envelopeAttachment.findMany).mockResolvedValue(mockAttachments as any);

          // Query attachments by token
          const result = await findAttachmentsByToken({
            envelopeId: spec.envelopeId,
            token: spec.token,
          });

          // Verify all attachments are returned
          expect(result).toHaveLength(spec.attachments.length);

          // Verify each attachment is associated with the correct envelope
          result.forEach((attachment) => {
            expect(attachment.envelopeId).toBe(spec.envelopeId);
          });
        }),
        { numRuns: 100 },
      );
    });

    it('should return empty array for envelope with no attachments', async () => {
      // Test that envelopes without attachments return empty array
      const envelopeGen = fc.uuid();

      await fc.assert(
        fc.asyncProperty(envelopeGen, async (envelopeId) => {
          vi.clearAllMocks();

          // Mock envelope exists
          vi.mocked(prisma.envelope.findFirst).mockResolvedValue({
            id: envelopeId,
            teamId: TEST_TEAM_ID,
          } as any);

          // Mock no attachments
          vi.mocked(prisma.envelopeAttachment.findMany).mockResolvedValue([]);

          const result = await findAttachmentsByEnvelopeId({
            envelopeId,
            userId: TEST_USER_ID,
            teamId: TEST_TEAM_ID,
          });

          // Verify empty array is returned
          expect(result).toEqual([]);
          expect(result).toHaveLength(0);
        }),
        { numRuns: 50 },
      );
    });

    it('should return both file and link attachments for the same envelope', async () => {
      // Test that both attachment types are returned together
      const mixedAttachmentsGen = fc.record({
        envelopeId: fc.uuid(),
        fileAttachments: fc.array(
          fc.record({
            id: fc.uuid(),
            label: fc.string({ minLength: 1, maxLength: 50 }),
            storageKey: fc.uuid(),
            fileSize: fc.integer({ min: 1, max: 10 * 1024 * 1024 }),
            contentType: fc.constantFrom('application/pdf', 'image/png'),
            hash: fc.hexaString({ minLength: 64, maxLength: 64 }),
          }),
          { minLength: 1, maxLength: 3 },
        ),
        linkAttachments: fc.array(
          fc.record({
            id: fc.uuid(),
            label: fc.string({ minLength: 1, maxLength: 50 }),
            url: fc.webUrl(),
          }),
          { minLength: 1, maxLength: 3 },
        ),
      });

      await fc.assert(
        fc.asyncProperty(mixedAttachmentsGen, async (spec) => {
          vi.clearAllMocks();

          // Mock envelope exists
          vi.mocked(prisma.envelope.findFirst).mockResolvedValue({
            id: spec.envelopeId,
            teamId: TEST_TEAM_ID,
          } as any);

          // Mock both file and link attachments
          const mockAttachments = [
            ...spec.fileAttachments.map((att) => ({
              id: att.id,
              type: 'file',
              label: att.label,
              data: att.storageKey,
              fileSize: att.fileSize,
              contentType: att.contentType,
              hash: att.hash,
              envelopeId: spec.envelopeId,
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
            ...spec.linkAttachments.map((att) => ({
              id: att.id,
              type: 'link',
              label: att.label,
              data: att.url,
              fileSize: null,
              contentType: null,
              hash: null,
              envelopeId: spec.envelopeId,
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
          ];

          vi.mocked(prisma.envelopeAttachment.findMany).mockResolvedValue(mockAttachments as any);

          const result = await findAttachmentsByEnvelopeId({
            envelopeId: spec.envelopeId,
            userId: TEST_USER_ID,
            teamId: TEST_TEAM_ID,
          });

          // Verify total count
          const expectedCount = spec.fileAttachments.length + spec.linkAttachments.length;
          expect(result).toHaveLength(expectedCount);

          // Verify file attachments have metadata
          const fileResults = result.filter((att) => att.type === 'file');
          expect(fileResults).toHaveLength(spec.fileAttachments.length);
          fileResults.forEach((att) => {
            expect(att.fileSize).not.toBeNull();
            expect(att.contentType).not.toBeNull();
            expect(att.hash).not.toBeNull();
          });

          // Verify link attachments don't have file metadata
          const linkResults = result.filter((att) => att.type === 'link');
          expect(linkResults).toHaveLength(spec.linkAttachments.length);
          linkResults.forEach((att) => {
            expect(att.fileSize).toBeNull();
            expect(att.contentType).toBeNull();
            expect(att.hash).toBeNull();
          });

          // Verify all attachments are associated with the same envelope
          result.forEach((attachment) => {
            expect(attachment.envelopeId).toBe(spec.envelopeId);
          });
        }),
        { numRuns: 50 },
      );
    });

    it('should maintain attachment-envelope association across multiple queries', async () => {
      // Test that the same attachments are returned on repeated queries
      const envelopeId = 'test-envelope-123';
      const attachments = [
        {
          id: 'att-1',
          type: 'file',
          label: 'document.pdf',
          data: 'storage/key1',
          fileSize: 1000,
          contentType: 'application/pdf',
          hash: 'hash1',
          envelopeId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'att-2',
          type: 'link',
          label: 'Reference',
          data: 'https://example.com',
          fileSize: null,
          contentType: null,
          hash: null,
          envelopeId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock envelope exists
      vi.mocked(prisma.envelope.findFirst).mockResolvedValue({
        id: envelopeId,
        teamId: TEST_TEAM_ID,
      } as any);

      vi.mocked(prisma.envelopeAttachment.findMany).mockResolvedValue(attachments as any);

      // Query multiple times
      const result1 = await findAttachmentsByEnvelopeId({
        envelopeId,
        userId: TEST_USER_ID,
        teamId: TEST_TEAM_ID,
      });

      const result2 = await findAttachmentsByEnvelopeId({
        envelopeId,
        userId: TEST_USER_ID,
        teamId: TEST_TEAM_ID,
      });

      // Verify results are consistent
      expect(result1).toHaveLength(2);
      expect(result2).toHaveLength(2);
      expect(result1.map((a) => a.id).sort()).toEqual(result2.map((a) => a.id).sort());

      // Verify all attachments belong to the same envelope
      [...result1, ...result2].forEach((attachment) => {
        expect(attachment.envelopeId).toBe(envelopeId);
      });
    });

    it('should return attachments in creation order', async () => {
      // Test that attachments are returned in the order they were created
      const envelopeId = 'test-envelope-order';
      const now = new Date();

      const attachments = [
        {
          id: 'att-3',
          type: 'file',
          label: 'third.pdf',
          data: 'storage/key3',
          envelopeId,
          createdAt: new Date(now.getTime() + 2000),
          updatedAt: new Date(),
        },
        {
          id: 'att-1',
          type: 'file',
          label: 'first.pdf',
          data: 'storage/key1',
          envelopeId,
          createdAt: new Date(now.getTime()),
          updatedAt: new Date(),
        },
        {
          id: 'att-2',
          type: 'file',
          label: 'second.pdf',
          data: 'storage/key2',
          envelopeId,
          createdAt: new Date(now.getTime() + 1000),
          updatedAt: new Date(),
        },
      ];

      // Mock envelope exists
      vi.mocked(prisma.envelope.findFirst).mockResolvedValue({
        id: envelopeId,
        teamId: TEST_TEAM_ID,
      } as any);

      // Mock attachments in creation order (sorted by createdAt asc)
      const sortedAttachments = [...attachments].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      vi.mocked(prisma.envelopeAttachment.findMany).mockResolvedValue(sortedAttachments as any);

      const result = await findAttachmentsByEnvelopeId({
        envelopeId,
        userId: TEST_USER_ID,
        teamId: TEST_TEAM_ID,
      });

      // Verify order matches creation order
      expect(result.map((a) => a.id)).toEqual(['att-1', 'att-2', 'att-3']);

      // Verify orderBy was specified in the query
      expect(prisma.envelopeAttachment.findMany).toHaveBeenCalledWith({
        where: {
          envelopeId,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    });

    it('should handle envelopes with large numbers of attachments', async () => {
      // Test that the association works with many attachments
      const largeAttachmentCountGen = fc.record({
        envelopeId: fc.uuid(),
        count: fc.constantFrom(10, 20, 50, 100),
      });

      await fc.assert(
        fc.asyncProperty(largeAttachmentCountGen, async (spec) => {
          vi.clearAllMocks();

          // Mock envelope exists
          vi.mocked(prisma.envelope.findFirst).mockResolvedValue({
            id: spec.envelopeId,
            teamId: TEST_TEAM_ID,
          } as any);

          // Generate many attachments
          const mockAttachments = Array.from({ length: spec.count }, (_, i) => ({
            id: `att-${i}`,
            type: i % 2 === 0 ? 'file' : 'link',
            label: `attachment-${i}.pdf`,
            data: `storage/key-${i}`,
            fileSize: i % 2 === 0 ? 1000 : null,
            contentType: i % 2 === 0 ? 'application/pdf' : null,
            hash: i % 2 === 0 ? `hash-${i}` : null,
            envelopeId: spec.envelopeId,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

          vi.mocked(prisma.envelopeAttachment.findMany).mockResolvedValue(mockAttachments as any);

          const result = await findAttachmentsByEnvelopeId({
            envelopeId: spec.envelopeId,
            userId: TEST_USER_ID,
            teamId: TEST_TEAM_ID,
          });

          // Verify all attachments are returned
          expect(result).toHaveLength(spec.count);

          // Verify all are associated with the same envelope
          result.forEach((attachment) => {
            expect(attachment.envelopeId).toBe(spec.envelopeId);
          });
        }),
        { numRuns: 20 },
      );
    });
  });
});
