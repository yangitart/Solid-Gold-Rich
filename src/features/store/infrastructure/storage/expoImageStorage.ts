import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import type { ImageStorage } from '@/features/store/application/ports/ImageStorage';

export const expoImageStorage: ImageStorage = {
  pick: async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return null;
    return { uri: result.assets[0].uri, name: result.assets[0].name };
  },
  copyToProductImages: async (sourceUri, extension) => {
    const directory = new Directory(Paths.document, 'product-images');
    directory.create({ idempotent: true, intermediates: true });
    const destination = new File(
      directory,
      `product-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${extension}`,
    );
    new File(sourceUri).copy(destination);
    return destination.uri;
  },
};
