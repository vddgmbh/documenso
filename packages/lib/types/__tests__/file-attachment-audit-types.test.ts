import { describe, expectTypeOf, it } from 'vitest';

import type { DocumentAuditLogByType } from '../document-audit-logs';

describe('File Attachment Audit Log Type Inference', () => {
  it('should correctly infer FileAttachmentUploadedData type', () => {
    type UploadedLog = DocumentAuditLogByType<'FILE_ATTACHMENT_UPLOADED'>;

    expectTypeOf<UploadedLog['data']>().toEqualTypeOf<{
      attachmentId: string;
      filename: string;
      fileSize: number;
      contentType: string;
      hash: string;
    }>();
  });

  it('should correctly infer FileAttachmentDownloadedData type', () => {
    type DownloadedLog = DocumentAuditLogByType<'FILE_ATTACHMENT_DOWNLOADED'>;

    expectTypeOf<DownloadedLog['data']>().toEqualTypeOf<{
      attachmentId: string;
      filename: string;
    }>();
  });

  it('should correctly infer FileAttachmentDeletedData type', () => {
    type DeletedLog = DocumentAuditLogByType<'FILE_ATTACHMENT_DELETED'>;

    expectTypeOf<DeletedLog['data']>().toEqualTypeOf<{
      attachmentId: string;
      filename: string;
    }>();
  });
});
