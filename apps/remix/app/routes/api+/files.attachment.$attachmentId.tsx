import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { downloadFileAttachment } from '@documenso/lib/server-only/attachment/download-file-attachment';
import { AppError } from '@documenso/lib/errors/app-error';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import type { Route } from './+types/files.attachment.$attachmentId';

/**
 * API Route: File Attachment Download
 * 
 * GET /api/files/attachment/:attachmentId
 * Query params: ?token=<recipient_token> (optional, for recipient access)
 * 
 * This route handles file attachment downloads with:
 * - Access control (user or recipient token)
 * - Hash verification for integrity
 * - Audit logging
 * - Appropriate content-type headers
 * 
 * Returns: File stream with X-File-Hash header
 */
export async function loader({ params, request }: Route.LoaderArgs) {
  const { attachmentId } = params;

  if (typeof attachmentId !== 'string') {
    return Response.json(
      {
        status: 'error',
        message: 'Missing attachment ID',
      },
      { status: 400 },
    );
  }

  // Extract authentication
  const session = await getOptionalSession(request);
  const userId = session.isAuthenticated ? session.user.id : undefined;

  // Extract recipient token from query params
  const url = new URL(request.url);
  const recipientToken = url.searchParams.get('token') || undefined;

  // Extract request metadata for audit logging
  const requestMetadata = extractRequestMetadata(request);

  try {
    // Download the file attachment
    const result = await downloadFileAttachment({
      attachmentId,
      userId,
      recipientToken,
      requestMetadata,
    });

    // Return file with appropriate headers
    return new Response(result.data, {
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(result.filename)}"`,
        'Content-Length': result.fileSize.toString(),
        'X-File-Hash': result.hash,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      // Map AppError codes to HTTP status codes
      const statusMap: Record<string, number> = {
        ACCESS_DENIED: 403,
        ATTACHMENT_NOT_FOUND: 404,
        INVALID_ATTACHMENT_TYPE: 400,
        INVALID_ATTACHMENT_DATA: 500,
        FILE_NOT_FOUND_IN_STORAGE: 500,
        HASH_VERIFICATION_FAILED: 500,
      };

      const status = statusMap[error.code] || 500;

      return Response.json(
        {
          status: 'error',
          message: error.message,
          code: error.code,
        },
        { status },
      );
    }

    // Handle unexpected errors
    console.error('Unexpected error in file attachment download:', error);
    return Response.json(
      {
        status: 'error',
        message: 'An unexpected error occurred',
      },
      { status: 500 },
    );
  }
}
