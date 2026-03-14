import { prisma } from '@documenso/prisma';

import { AppError } from '../../errors/app-error';

/**
 * Options for checking attachment access
 */
export interface CheckAttachmentAccessOptions {
  /**
   * The ID of the attachment to check access for
   */
  attachmentId: string;

  /**
   * The ID of the user requesting access (optional)
   */
  userId?: number;

  /**
   * The recipient token for token-based access (optional)
   */
  recipientToken?: string;
}

/**
 * Check if a user has permission to access a file attachment
 * 
 * This function verifies that users have permission to access file attachments
 * based on their relationship to the envelope. Access is granted if:
 * 1. The user is the envelope owner (created the document)
 * 2. The user is a recipient of the envelope
 * 3. A valid recipient token is provided
 * 
 * At least one of userId or recipientToken must be provided.
 * 
 * @param options - Access check options including attachment ID and user/token info
 * @returns true if access is granted, false otherwise
 * @throws AppError if attachment not found or neither userId nor recipientToken provided
 */
export async function checkAttachmentAccess(
  options: CheckAttachmentAccessOptions,
): Promise<boolean> {
  const { attachmentId, userId, recipientToken } = options;

  // Validate that at least one authentication method is provided
  if (!userId && !recipientToken) {
    throw new AppError(
      'INVALID_REQUEST',
      'Either userId or recipientToken must be provided',
    );
  }

  // Fetch the attachment with its associated envelope and recipients
  const attachment = await prisma.envelopeAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      envelope: {
        include: {
          recipients: {
            select: {
              id: true,
              email: true,
              token: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!attachment) {
    throw new AppError('ATTACHMENT_NOT_FOUND', `Attachment ${attachmentId} not found`);
  }

  const { envelope } = attachment;

  // Check 1: Is the user the envelope owner?
  if (userId && envelope.userId === userId) {
    return true;
  }

  // Check 2: Is the user a recipient of the envelope?
  if (userId) {
    // Get the user's email to check against recipients
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (user) {
      const isRecipient = envelope.recipients.some(
        (recipient) => recipient.email.toLowerCase() === user.email.toLowerCase(),
      );

      if (isRecipient) {
        return true;
      }
    }
  }

  // Check 3: Is a valid recipient token provided?
  if (recipientToken) {
    const isValidToken = envelope.recipients.some(
      (recipient) => recipient.token === recipientToken,
    );

    if (isValidToken) {
      return true;
    }
  }

  // No access granted
  return false;
}
