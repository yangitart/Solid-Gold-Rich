import { File } from 'expo-file-system';
import type { StoreProduct, StoreState } from '../../core/finance/types';

const BACKUP_KIND = 'solid-gold-rich-store';
const BACKUP_VERSION = 1;

type EmbeddedPicture = { mimeType: string; data: string };
type StoreProductBackup = Omit<StoreProduct, 'picture'> & { picture?: EmbeddedPicture };
export type StoreBackup = {
  kind: typeof BACKUP_KIND;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  store: Omit<StoreState, 'products'> & { products: StoreProductBackup[] };
};

function mimeTypeFor(uri: string) {
  const extension = uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isEmbeddedPicture(value: unknown): value is EmbeddedPicture {
  return isRecord(value)
    && typeof value.mimeType === 'string'
    && value.mimeType.startsWith('image/')
    && typeof value.data === 'string'
    && value.data.length > 0
    && /^[A-Za-z0-9+/]+={0,2}$/.test(value.data);
}

function isStoreBackup(value: unknown): value is StoreBackup {
  if (!isRecord(value) || value.kind !== BACKUP_KIND || value.version !== BACKUP_VERSION || typeof value.exportedAt !== 'string' || !isRecord(value.store)) return false;
  const store = value.store;
  return Array.isArray(store.categories)
    && Array.isArray(store.products)
    && Array.isArray(store.stockMovements)
    && Array.isArray(store.sales)
    && Array.isArray(store.clients)
    && Array.isArray(store.employees)
    && Array.isArray(store.cashMovements)
    && store.products.every((product) => isRecord(product) && (!('picture' in product) || product.picture === undefined || isEmbeddedPicture(product.picture)));
}

export async function createStoreBackup(store: StoreState): Promise<StoreBackup> {
  const products = await Promise.all(store.products.map(async (product): Promise<StoreProductBackup> => {
    const { picture, ...productWithoutPicture } = product;
    if (!picture) return productWithoutPicture;
    if (picture.startsWith('data:')) {
      const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(picture);
      if (!match) throw new Error('invalid-product-picture');
      return { ...productWithoutPicture, picture: { mimeType: match[1].toLowerCase(), data: match[2] } };
    }
    const data = await new File(picture).base64();
    if (!data) throw new Error('invalid-product-picture');
    return { ...productWithoutPicture, picture: { mimeType: mimeTypeFor(picture), data } };
  }));
  return { kind: BACKUP_KIND, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), store: { ...store, products } };
}

export function parseStoreBackup(text: string): StoreBackup {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('invalid-store-backup'); }
  if (!isStoreBackup(value)) throw new Error('invalid-store-backup');
  return value;
}

export function restoreStoreBackup(backup: StoreBackup): StoreState {
  const products = backup.store.products.map((product) => {
    const { picture, ...productWithoutPicture } = product;
    if (!picture) return productWithoutPicture;
    return { ...productWithoutPicture, picture: `data:${picture.mimeType};base64,${picture.data}` };
  });
  return { ...backup.store, products } as StoreState;
}
