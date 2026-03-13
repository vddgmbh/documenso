/**
 * File attachment validation utility
 * Validates file attachments before upload, checking file type and size constraints.
 */

/**
 * Allowed file extensions for attachments
 */
export const ALLOWED_FILE_EXTENSIONS = [
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'txt',
  'csv',
] as const;

/**
 * Maximum file size in bytes (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Result of file validation
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Extract file extension from filename
 * @param filename - The filename to extract extension from
 * @returns The file extension in lowercase, or empty string if no extension
 */
function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return '';
  }
  return filename.slice(lastDotIndex + 1).toLowerCase();
}

/**
 * Validate a file attachment
 * Checks file type (extension) and size constraints
 *
 * @param file - The file to validate
 * @returns ValidationResult indicating if the file is valid and any error message
 */
export function validateFileAttachment(file: File): ValidationResult {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  // Check file extension
  const extension = getFileExtension(file.name);
  
  if (!extension) {
    return {
      valid: false,
      error: 'File has no extension',
    };
  }

  if (!ALLOWED_FILE_EXTENSIONS.includes(extension as typeof ALLOWED_FILE_EXTENSIONS[number])) {
    return {
      valid: false,
      error: `File type '.${extension}' is not allowed. Allowed types: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`,
    };
  }

  // File is valid
  return {
    valid: true,
  };
}
