import { vi } from 'vitest';
import { Blob } from 'node:buffer';

// Mock @lingui/core before any imports
vi.mock('@lingui/core', () => ({
  msg: (strings: TemplateStringsArray | string) => {
    if (typeof strings === 'string') return strings;
    return strings[0];
  },
  i18n: {
    _: (id: string) => id,
  },
}));

// Polyfill File API for Node.js test environment
if (typeof globalThis.File === 'undefined') {
  class FilePolyfill extends Blob {
    public name: string;
    public lastModified: number;

    constructor(bits: BlobPart[], name: string, options?: FilePropertyBag) {
      super(bits, options);
      this.name = name;
      this.lastModified = options?.lastModified ?? Date.now();
    }
  }

  globalThis.File = FilePolyfill as any;
}
