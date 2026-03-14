import { bytesToHex } from '@noble/ciphers/utils';

import { sha256 } from '@documenso/lib/universal/crypto';

/**
 * Computes the SHA-256 hash of a file attachment.
 *
 * @param file - The file content as a Uint8Array
 * @returns The hex-encoded SHA-256 hash string
 */
export function computeFileHash(file: Uint8Array): string {
  const hashBytes = sha256(file);
  return bytesToHex(hashBytes);
}
