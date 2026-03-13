import { describe, expect, it } from 'vitest';

import { computeFileHash } from './file-attachment-hash';

describe('computeFileHash', () => {
  it('should compute SHA-256 hash for a simple file', () => {
    const file = new Uint8Array([1, 2, 3, 4, 5]);
    const hash = computeFileHash(file);

    // SHA-256 hash should be 64 hex characters
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash.length).toBe(64);
  });

  it('should compute consistent hash for the same input', () => {
    const file = new Uint8Array([1, 2, 3, 4, 5]);
    const hash1 = computeFileHash(file);
    const hash2 = computeFileHash(file);

    expect(hash1).toBe(hash2);
  });

  it('should compute different hashes for different inputs', () => {
    const file1 = new Uint8Array([1, 2, 3, 4, 5]);
    const file2 = new Uint8Array([5, 4, 3, 2, 1]);

    const hash1 = computeFileHash(file1);
    const hash2 = computeFileHash(file2);

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty file', () => {
    const file = new Uint8Array([]);
    const hash = computeFileHash(file);

    // SHA-256 of empty input is a known value
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('should compute known SHA-256 test vector', () => {
    // Test vector: "abc" -> ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
    const file = new Uint8Array([97, 98, 99]); // "abc" in ASCII
    const hash = computeFileHash(file);

    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('should handle large file', () => {
    // Create a 1MB file
    const file = new Uint8Array(1024 * 1024);
    for (let i = 0; i < file.length; i++) {
      file[i] = i % 256;
    }

    const hash = computeFileHash(file);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash.length).toBe(64);
  });
});
