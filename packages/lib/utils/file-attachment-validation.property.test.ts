import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_SIZE,
  validateFileAttachment,
} from './file-attachment-validation';

/**
 * Property-Based Tests for File Attachment Validation
 * Feature: document-file-attachments
 */
describe('file-attachment-validation - Property-Based Tests', () => {
  /**
   * Property 2: File Type Validation
   * **Validates: Requirements 1.6**
   *
   * For any file with an extension not in the allowed list,
   * attempting to upload it should result in rejection with an appropriate error message.
   */
  describe('Property 2: File Type Validation', () => {
    it('should reject all files with invalid extensions', () => {
      // Generator for invalid file extensions
      // Excludes all allowed extensions and generates random strings
      // Also excludes strings that would result in "no extension" error
      const invalidExtensionGen = fc
        .string({ minLength: 1, maxLength: 10 })
        .filter((ext) => {
          const normalized = ext.toLowerCase().trim();
          // Exclude empty or whitespace-only extensions
          if (normalized === '') {
            return false;
          }
          // Exclude extensions that end with a dot (would be treated as no extension)
          if (normalized.endsWith('.')) {
            return false;
          }
          // Exclude extensions that contain dots (would be parsed differently)
          if (normalized.includes('.')) {
            return false;
          }
          // Exclude allowed extensions
          return !ALLOWED_FILE_EXTENSIONS.includes(
            normalized as (typeof ALLOWED_FILE_EXTENSIONS)[number],
          );
        });

      // Generator for filenames with invalid extensions
      const invalidFileGen = fc.record({
        basename: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim() !== ''),
        extension: invalidExtensionGen,
        size: fc.integer({ min: 0, max: MAX_FILE_SIZE }),
        content: fc.string(),
      });

      fc.assert(
        fc.property(invalidFileGen, (fileSpec) => {
          // Create a File object with invalid extension
          const filename = `${fileSpec.basename}.${fileSpec.extension}`;
          const file = new File([fileSpec.content], filename, {
            type: 'application/octet-stream',
          });

          // Validate the file
          const result = validateFileAttachment(file);

          // Assert that the file is rejected
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          // The error should indicate the file type is not allowed
          expect(result.error).toContain('not allowed');
        }),
        { numRuns: 100 },
      );
    });

    it('should reject files with no extension', () => {
      // Generator for filenames without extensions
      const noExtensionFileGen = fc.record({
        basename: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes('.')),
        size: fc.integer({ min: 0, max: MAX_FILE_SIZE }),
        content: fc.string(),
      });

      fc.assert(
        fc.property(noExtensionFileGen, (fileSpec) => {
          // Create a File object without extension
          const file = new File([fileSpec.content], fileSpec.basename, {
            type: 'application/octet-stream',
          });

          // Validate the file
          const result = validateFileAttachment(file);

          // Assert that the file is rejected
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('no extension');
        }),
        { numRuns: 100 },
      );
    });

    it('should reject files with extension ending in dot', () => {
      // Generator for filenames ending with a dot
      const dotEndingFileGen = fc.record({
        basename: fc.string({ minLength: 1, maxLength: 50 }),
        size: fc.integer({ min: 0, max: MAX_FILE_SIZE }),
        content: fc.string(),
      });

      fc.assert(
        fc.property(dotEndingFileGen, (fileSpec) => {
          // Create a File object with filename ending in dot
          const filename = `${fileSpec.basename}.`;
          const file = new File([fileSpec.content], filename, {
            type: 'application/octet-stream',
          });

          // Validate the file
          const result = validateFileAttachment(file);

          // Assert that the file is rejected
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('no extension');
        }),
        { numRuns: 100 },
      );
    });

    it('should reject files with common disallowed extensions', () => {
      // Generator for common disallowed extensions
      const disallowedExtensions = [
        'exe',
        'bat',
        'cmd',
        'sh',
        'dll',
        'so',
        'dylib',
        'app',
        'deb',
        'rpm',
        'msi',
        'dmg',
        'pkg',
        'apk',
        'jar',
        'war',
        'ear',
        'zip',
        'rar',
        '7z',
        'tar',
        'gz',
        'bz2',
        'iso',
        'img',
        'js',
        'jsx',
        'ts',
        'tsx',
        'py',
        'rb',
        'php',
        'asp',
        'aspx',
        'jsp',
        'cgi',
        'pl',
        'vbs',
        'ps1',
        'psm1',
      ];

      const disallowedFileGen = fc.record({
        basename: fc.string({ minLength: 1, maxLength: 50 }),
        extension: fc.constantFrom(...disallowedExtensions),
        size: fc.integer({ min: 0, max: MAX_FILE_SIZE }),
        content: fc.string(),
      });

      fc.assert(
        fc.property(disallowedFileGen, (fileSpec) => {
          // Create a File object with disallowed extension
          const filename = `${fileSpec.basename}.${fileSpec.extension}`;
          const file = new File([fileSpec.content], filename, {
            type: 'application/octet-stream',
          });

          // Validate the file
          const result = validateFileAttachment(file);

          // Assert that the file is rejected
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('not allowed');
        }),
        { numRuns: 100 },
      );
    });

    it('should accept all files with valid extensions regardless of case', () => {
      // Generator for valid file extensions with random case
      const validExtensionGen = fc
        .constantFrom(...ALLOWED_FILE_EXTENSIONS)
        .chain((ext) =>
          fc.array(fc.boolean(), { minLength: ext.length, maxLength: ext.length }).map((cases) =>
            ext
              .split('')
              .map((char, i) => (cases[i] ? char.toUpperCase() : char.toLowerCase()))
              .join(''),
          ),
        );

      const validFileGen = fc.record({
        basename: fc.string({ minLength: 1, maxLength: 50 }),
        extension: validExtensionGen,
        size: fc.integer({ min: 0, max: MAX_FILE_SIZE }),
        content: fc.string(),
      });

      fc.assert(
        fc.property(validFileGen, (fileSpec) => {
          // Create a File object with valid extension
          const filename = `${fileSpec.basename}.${fileSpec.extension}`;
          const file = new File([fileSpec.content], filename, {
            type: 'application/octet-stream',
          });

          // Validate the file
          const result = validateFileAttachment(file);

          // Assert that the file is accepted
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }),
        { numRuns: 100 },
      );
    });
  });
});
