import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import type { FileService } from '@/application/ports/FileService';
import { bytesToBase64 } from '@/shared/encoding/base64';

function cacheFile(fileName: string) {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  return file;
}

export const expoFileService: FileService = {
  writeText: async (fileName, content) => { const file = cacheFile(fileName); file.write(content); return file.uri; },
  writeBase64: async (fileName, content) => { const file = cacheFile(fileName); file.write(content, { encoding: 'base64' }); return file.uri; },
  writeBytes: async (fileName, content) => { const file = cacheFile(fileName); file.write(bytesToBase64(content), { encoding: 'base64' }); return file.uri; },
  readText: (uri) => new File(uri).text(),
  readBase64: (uri) => new File(uri).base64(),
  pick: async (types) => {
    const result = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets[0]) return null;
    return { uri: result.assets[0].uri, name: result.assets[0].name };
  },
  share: async (uri, mimeType, dialogTitle) => { if (!await Sharing.isAvailableAsync()) throw new Error('sharing-unavailable'); await Sharing.shareAsync(uri, { mimeType, dialogTitle }); },
};
