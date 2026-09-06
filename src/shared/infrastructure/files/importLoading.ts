/** Files at or above this size can block the JS thread while they are parsed. */
export const LARGE_IMPORT_SIZE_BYTES = 5 * 1024 * 1024;

/** Let React paint the loading modal before reading/parsing a picked file. */
export function waitForImportLoading(size?: number) {
  const delay = size === undefined || size >= LARGE_IMPORT_SIZE_BYTES ? 50 : 0;
  return new Promise<void>((resolve) => setTimeout(resolve, delay));
}
