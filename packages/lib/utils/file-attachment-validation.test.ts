import { describe, expect, it } from 'vitest';

import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_SIZE,
  validateFileAttachment,
} from './file-attachment-validation';

describe('file-attachment-validation', () => {
  describe('validateFileAttachment', () => {
    describe('valid files', () => {
      it.each(ALLOWED_FILE_EXTENSIONS)('should accept file with .%s extension', (extension) => {
        const file = new File(['test content'], `test.${extension}`, {
          type: 'application/octet-stream',
        });

        const result = validateFileAttachment(file);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should accept file with uppercase extension', () => {
        const file = new File(['test content'], 'test.PDF', {
          type: 'application/pdf',
        });

        const result = validateFileAttachment(file);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should accept file with mixed case extension', () => {
        const file = new File(['test content'], 'test.JpEg', {
          type: 'image/jpeg',
        });

        const result = validateFileAttachment(file);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should accept file exactly at 10MB size', () => {
        const content = new Uint8Array(MAX_FILE_SIZE);
        const file = new File([content], 'test.pdf', {
          type: 'application/pdf',
        });

        const result = validateFileAttachment(file);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should accept empty file (0 bytes)', () => {
        const file = new File([], 'test.pdf', {
          type: 'application/pdf',
        });

        const result = validateFileAttachment(file);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should accept file with multiple dots in name', () => {
        const file = new File(['test content'], 'my.test.file.pdf', {
          type: 'application/pdf',
        });

        const result = validateFileAttachment(file);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    describe('invalid file size', () => {
      it('should reject file exceeding 10MB', () => {
        const content = new Uint8Array(MAX_FILE_SIZE + 1);
        const file = new File([content], 'test.pdf', {
          type: 'application/pdf',
        });

        const result = validateFileAttachment(file);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('File size exceeds maximum allowed size of 10MB');
      });

      it('should reject file much larger than 10MB', () => {
        const content = new Uint8Array(50 * 1024 * 1024); // 50MB
        const file = new File([content], 'test.pdf', {
          type: 'application/pdf',
        });

        const result = validateFileAttachment(file);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('File size exceeds maximum allowed size');
      });
    });

    describe('invalid file type', () => {
      it('should reject file with no extension', () => {
        const file = new File(['test content'], 'testfile', {
          type: 'application/octet-stream',
        });

        const result = validateFileAttachment(file);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('File has no extension');
      });

      it('should reject file with only a dot', () => {
        const file = new File(['test content'], 'testfile.', {
          type: 'application/octet-stream',
        });

        const result = validateFileAttachment(file);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('File has no extension');
      });

      it('should reject file with disallowed extension (.exe)', () => {
        const file = new File(['test content'], 'malware.exe', {
          type: 'application/x-msdownload',
        });

        const result = validateFileAttachment(file);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('File type \'.exe\' is not allowed');
        expect(result.error).toContain('Allowed types:');
      });

      it('should reject file with disallowed extension (.zip)', () => {
        const file = new File(['test content'], 'archive.zip', {
          type: 'application/zip',
        });

        const result = validateFileAttachment(file);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('File type \'.zip\' is not allowed');
      });

      it('should reject file with disallowed extension (.js)', () => {
        const file = new File(['test content'], 'script.js', {
          type: 'application/javascript',
        });

        const result = validateFileAttachment(file);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('File type \'.js\' is not allowed');
      });
    });
  });
});
