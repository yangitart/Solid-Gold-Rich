export type FileAsset = { uri: string; name: string; size?: number };

export type FileService = {
  writeText: (fileName: string, content: string) => Promise<string>;
  writeBase64: (fileName: string, content: string) => Promise<string>;
  writeBytes: (fileName: string, content: Uint8Array) => Promise<string>;
  readText: (uri: string) => Promise<string>;
  readBase64: (uri: string) => Promise<string>;
  pick: (types: string | string[]) => Promise<FileAsset | null>;
  share: (uri: string, mimeType: string, dialogTitle: string) => Promise<void>;
};
