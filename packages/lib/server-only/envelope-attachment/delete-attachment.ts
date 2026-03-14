import { DocumentDataType, DocumentStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { deleteFile } from '../../universal/upload/delete-file';
import { env } from '../../utils/env';
import { buildTeamWhereQuery } from '../../utils/teams';
import { logFileAttachmentDelete } from './log-file-attachment-audit';

export type DeleteAttachmentOptions = {
  id: string;
  userId: number;
  teamId: number;
};

export const deleteAttachment = async ({ id, userId, teamId }: DeleteAttachmentOptions) => {
  const attachment = await prisma.envelopeAttachment.findFirst({
    where: {
      id,
      envelope: {
        team: buildTeamWhereQuery({ teamId, userId }),
      },
    },
    include: {
      envelope: true,
    },
  });

  if (!attachment) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Attachment not found',
    });
  }

  if (
    attachment.envelope.status === DocumentStatus.COMPLETED ||
    attachment.envelope.status === DocumentStatus.REJECTED
  ) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Attachments can not be modified after the document has been completed or rejected',
    });
  }

  // If this is a file attachment, delete the file from storage and log the deletion
  if (attachment.type === 'file') {
    const NEXT_PUBLIC_UPLOAD_TRANSPORT = env('NEXT_PUBLIC_UPLOAD_TRANSPORT');
    const storageType =
      NEXT_PUBLIC_UPLOAD_TRANSPORT === 's3' ? DocumentDataType.S3_PATH : DocumentDataType.BYTES_64;

    try {
      await deleteFile({
        type: storageType,
        data: attachment.data,
      });
    } catch (error) {
      // Log error but continue with database deletion
      console.error(`Failed to delete file from storage for attachment ${id}:`, error);
    }
  }

  await prisma.envelopeAttachment.delete({
    where: {
      id,
    },
  });

  // Log deletion for file attachments
  if (attachment.type === 'file') {
    try {
      await logFileAttachmentDelete({
        attachmentId: attachment.id,
        filename: attachment.label,
        userId,
        envelopeId: attachment.envelope.id,
      });
    } catch (error) {
      // Audit log failure should not prevent the deletion from succeeding
      console.error('Failed to create audit log for file attachment deletion:', error);
    }
  }
};
