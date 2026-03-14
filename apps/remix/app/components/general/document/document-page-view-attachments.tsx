import { Trans } from '@lingui/react/macro';
import { Download, ExternalLink, FileIcon, PaperclipIcon } from 'lucide-react';

import { formatBytes } from '@documenso/lib/universal/format-bytes';
import { trpc } from '@documenso/trpc/react';

export type DocumentPageViewAttachmentsProps = {
  envelopeId: string;
};

export const DocumentPageViewAttachments = ({ envelopeId }: DocumentPageViewAttachmentsProps) => {
  const { data: attachments } = trpc.envelope.attachment.find.useQuery({
    envelopeId,
  });

  if (!attachments || attachments.data.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col rounded-xl border border-border bg-widget p-6">
      <h3 className="text-lg font-semibold text-foreground">
        <Trans>Attachments</Trans>
      </h3>

      <p className="mt-1 text-sm text-muted-foreground">
        <Trans>Supporting documents and resources</Trans>
      </p>

      <div className="mt-4 space-y-2">
        {attachments.data.map((attachment) => {
          const isFileAttachment = attachment.type === 'file';
          const downloadUrl = isFileAttachment
            ? `/api/files/attachment/${attachment.id}`
            : attachment.data;

          return (
            <a
              key={attachment.id}
              href={downloadUrl}
              title={isFileAttachment ? attachment.label : attachment.data}
              target="_blank"
              rel="noopener noreferrer"
              download={isFileAttachment ? attachment.label : undefined}
              className="border-border hover:bg-muted/50 group flex items-center justify-between rounded-md border bg-background px-3 py-3 transition duration-200"
            >
              <div className="flex flex-1 items-center gap-3">
                <div className="bg-muted rounded p-2">
                  {isFileAttachment ? (
                    <FileIcon className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <PaperclipIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{attachment.label}</p>
                  {isFileAttachment && attachment.fileSize && (
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(attachment.fileSize)}
                      {attachment.contentType && ` • ${attachment.contentType.split('/')[1]}`}
                    </p>
                  )}
                  {!isFileAttachment && (
                    <p className="truncate text-xs text-muted-foreground underline">
                      {attachment.data}
                    </p>
                  )}
                </div>
              </div>

              {isFileAttachment ? (
                <Download className="h-5 w-5 flex-shrink-0 text-muted-foreground opacity-0 transition duration-200 group-hover:opacity-100" />
              ) : (
                <ExternalLink className="h-5 w-5 flex-shrink-0 text-muted-foreground opacity-0 transition duration-200 group-hover:opacity-100" />
              )}
            </a>
          );
        })}
      </div>
    </section>
  );
};
