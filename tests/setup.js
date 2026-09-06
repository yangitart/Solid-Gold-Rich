import { beforeEach, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  storage: new Map(),
  fileContents: new Map(),
}));
export const storage = mockState.storage;
export const fileContents = mockState.fileContents;
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key) => storage.get(key) ?? null,
    setItem: async (key, value) => storage.set(key, value),
    multiRemove: async (keys) => keys.forEach((key) => storage.delete(key)),
  },
}));
vi.mock('expo-file-system', () => {
  class MockFile {
    constructor(...parts) {
      const values = parts.map((part) => (typeof part === 'string' ? part : part.uri));
      this.uri =
        values.length === 1
          ? values[0]
          : `${values[0].replace(/\/$/, '')}/${values
              .slice(1)
              .map((value) => value.replace(/^\//, ''))
              .join('/')}`;
    }

    async base64() {
      if (!fileContents.has(this.uri)) throw new Error('file-not-found');
      return fileContents.get(this.uri);
    }

    create() {}

    write(content) {
      fileContents.set(this.uri, content);
    }
  }
  class MockDirectory {
    constructor(...parts) {
      const values = parts.map((part) => (typeof part === 'string' ? part : part.uri));
      this.uri =
        values.length === 1
          ? values[0]
          : `${values[0].replace(/\/$/, '')}/${values
              .slice(1)
              .map((value) => value.replace(/^\//, ''))
              .join('/')}`;
    }

    create() {}
  }

  return {
    Directory: MockDirectory,
    File: MockFile,
    Paths: { document: 'file:///documents', cache: 'file:///cache' },
  };
});
beforeEach(() => {
  storage.clear();
  fileContents.clear();
});
