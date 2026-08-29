export type ImageStorage = {
  pick: () => Promise<{ uri: string; name: string } | null>;
  copyToProductImages: (sourceUri: string, extension: string) => Promise<string>;
};
