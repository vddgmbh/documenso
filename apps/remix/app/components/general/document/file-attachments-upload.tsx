import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { FileIcon, Loader2, Upload, X } from 'lucide-react';
import { ErrorCode as DropzoneErrorCode, useDropzone } from 'react-dropzone';

import { AppError } from '@documenso/lib/errors/app-error';
import { formatBytes } from '@documenso/lib/universal/format-bytes';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { useToast } from '@documenso/ui/primitives/use-toast';

const ALLOWED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export type FileAttachmentsUploadProps = {
  envelopeId: string;
  disabled?: boolean;
  className?: string;
};

type LocalFile = {
  id: string;
  file: File;
  label: string;
  isUploading: boolean;
  isError: boolean;
  attachmentId?: string;
};

export const FileAttachmentsUpload = ({
  envelopeId,
  disabled = false,
  className,
}: FileAttachmentsUploadProps) => {
  const { toast } = useToast();
  const { _ } = useLingui();

  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);

  const utils = trpc.useUtils();

  const { data: attachments } = trpc.envelope.attachment.find.useQuery({
    envelopeId,
  });

  const { mutateAsync: uploadFileAttachment } =
    trpc.envelope.attachment.uploadFile.useMutation({
      onSuccess: () => {
        void utils.envelope.attachment.find.invalidate({ envelopeId });
      },
    });

  const { mutateAsync: deleteAttachment } = trpc.envelope.attachment.delete.useMutation({
    onSuccess: () => {
      void utils.envelope.attachment.find.invalidate({ envelopeId });
    },
  });

  const onDrop = async (acceptedFiles: File[]) => {
    const newFiles: LocalFile[] = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      label: file.name,
      isUploading: true,
      isError: false,
    }));

    setLocalFiles((prev) => [...prev, ...newFiles]);

    // Upload files one by one
    for (const localFile of newFiles) {
      try {
        // Convert file to base64 using browser APIs
        const arrayBuffer = await localFile.file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        const result = await uploadFileAttachment({
          envelopeId,
          fileBase64: base64,
          fileName: localFile.file.name,
          fileType: localFile.file.type,
        });

        setLocalFiles((prev) =>
          prev.map((f) =>
            f.id === localFile.id
              ? { ...f, isUploading: false, attachmentId: result.id }
              : f,
          ),
        );

        toast({
          title: _(msg`Success`),
          description: _(msg`File uploaded successfully.`),
        });
      } catch (err) {
        const error = AppError.parseError(err);

        setLocalFiles((prev) =>
          prev.map((f) =>
            f.id === localFile.id ? { ...f, isUploading: false, isError: true } : f,
          ),
        );

        toast({
          title: _(msg`Upload failed`),
          description: error.message,
          variant: 'destructive',
        });
      }
    }
  };

  const onDropRejected = (fileRejections: unknown[]) => {
    const fileTooLarge = fileRejections.some((rejection: { errors: { code: string }[] }) =>
      rejection.errors.some((error: { code: string }) => error.code === DropzoneErrorCode.FileTooLarge),
    );

    const invalidType = fileRejections.some((rejection: { errors: { code: string }[] }) =>
      rejection.errors.some((error: { code: string }) => error.code === DropzoneErrorCode.FileInvalidType),
    );

    if (fileTooLarge) {
      toast({
        title: _(msg`File too large`),
        description: _(msg`Files must be smaller than 10MB.`),
        variant: 'destructive',
      });
    } else if (invalidType) {
      toast({
        title: _(msg`Invalid file type`),
        description: _(msg`Only PDF, images, Office documents, and text files are allowed.`),
        variant: 'destructive',
      });
    } else {
      toast({
        title: _(msg`Upload failed`),
        description: _(msg`Please check your files and try again.`),
        variant: 'destructive',
      });
    }
  };

  const onDeleteFile = async (localFileId: string, attachmentId?: string) => {
    if (attachmentId) {
      try {
        await deleteAttachment({ id: attachmentId });

        toast({
          title: _(msg`Success`),
          description: _(msg`File removed successfully.`),
        });
      } catch (err) {
        const error = AppError.parseError(err);

        toast({
          title: _(msg`Error`),
          description: error.message,
          variant: 'destructive',
        });

        return;
      }
    }

    setLocalFiles((prev) => prev.filter((f) => f.id !== localFileId));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      void onDrop(files);
    },
    onDropRejected,
    accept: ALLOWED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    disabled,
  });

  const fileAttachments =
    attachments?.data.filter((a) => a.type === 'file' && a.fileSize !== null) || [];

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <h4 className="text-sm font-medium">
          <Trans>File Attachments</Trans>
        </h4>
        <p className="mt-1 text-xs text-muted-foreground">
          <Trans>Upload supporting documents (PDF, images, Office files, etc.)</Trans>
        </p>
      </div>

      {/* Dropzone */}
      <Card
        {...getRootProps()}
        className={cn(
          'cursor-pointer border-2 border-dashed transition-colors hover:border-primary/50',
          isDragActive && 'border-primary bg-primary/5',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <CardContent className="flex flex-col items-center justify-center py-8">
          <input {...getInputProps()} />
          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-center text-sm text-muted-foreground">
            {isDragActive ? (
              <Trans>Drop files here...</Trans>
            ) : (
              <Trans>Drag and drop files here, or click to select</Trans>
            )}
          </p>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            <Trans>Max 10MB per file</Trans>
          </p>
        </CardContent>
      </Card>

      {/* Uploaded Files List */}
      {(localFiles.length > 0 || fileAttachments.length > 0) && (
        <div className="space-y-2">
          {/* Files from server */}
          {fileAttachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between rounded-md border border-border bg-background p-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <FileIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{attachment.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {attachment.fileSize ? formatBytes(attachment.fileSize) : ''}
                    {attachment.contentType && ` • ${attachment.contentType.split('/')[1]}`}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void onDeleteFile('', attachment.id);
                }}
                className="ml-2 h-8 w-8 p-0"
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {/* Local uploading files */}
          {localFiles.map((localFile) => (
            <div
              key={localFile.id}
              className="flex items-center justify-between rounded-md border border-border bg-background p-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {localFile.isUploading ? (
                  <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <FileIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{localFile.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {localFile.isUploading ? (
                      <Trans>Uploading...</Trans>
                    ) : localFile.isError ? (
                      <span className="text-destructive">
                        <Trans>Upload failed</Trans>
                      </span>
                    ) : (
                      formatBytes(localFile.file.size)
                    )}
                  </p>
                </div>
              </div>

              {!localFile.isUploading && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void onDeleteFile(localFile.id, localFile.attachmentId);
                  }}
                  className="ml-2 h-8 w-8 p-0"
                  disabled={disabled}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
