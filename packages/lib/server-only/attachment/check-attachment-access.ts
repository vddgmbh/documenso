import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

/**
 * Options for checking attachment access
 */
export interface CheckAttachmentAccessOptions {
  attachmentId: string;
  userId?: number;
  recipientToken?: string;
}

/**
 * Check if a user has permission to access a file attachment.
 *
 * Access is granted if:
 * 1. The user is the envelope owner
 * 2. The user is a recipient of the envelope
 * 3. A valid recipient token is provided
 */
export async function checkAttachmentAccess(
  options: CheckAttachmentAccessOptions,
): Promise<boolean> {
  const { attachmentId, userId, recipientToken } = options;

  if (!userId && !recipientToken) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Either userId or recipientToken must be provided',
    });
  }

  const attachment = await prisma.envelopeAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      envelope: {
        include: {
          recipients: {
            select: { id: true, email: true, token: true },
          },
          user: {
            select: { id: true, email: true },
          },
        },
      },
    },
  });

  if (!attachment) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Attachment ${attachmentId} not found`,
    });
  }

  const { envelope } = attachment;

  // Owner check
  if (userId && envelope.userId === userId) {
    return true;
  }

  // Recipient check (by email)
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (user) {
      const isRecipient = envelope.recipients.some(
        (r) => r.email.toLowerCase() === user.email.toLowerCase(),
      );
      if (isRecipient) return true;
    }
  }

  // Token check
  if (recipientToken) {
    const isValidToken = envelope.recipients.some((r) => r.token === recipientToken);
    if (isValidToken) return true;
  }

  return false;
}
