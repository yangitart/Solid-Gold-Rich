import { Directory, File, Paths } from 'expo-file-system';
import type { AppState as FinanceState } from '@/domain/AppState';
import type { StoreState } from '@/features/store/domain/entities/Store';
import type { AppBackup, EmbeddedPicture, StoreBackup, StoreProductBackup } from '@/features/backup/application/ports/BackupTypes';

const BACKUP_KIND = 'solid-gold-rich-store';
const BACKUP_VERSION = 1;
const APP_BACKUP_KIND = 'solid-gold-rich-full';
const APP_BACKUP_VERSION = 1;
const APP_ARCHIVE_KIND = 'solid-gold-rich-archive';
const APP_ARCHIVE_VERSION = 1;

type ArchivePicture = { mimeType: string; path: string };
type ArchiveProduct = Omit<StoreProductBackup, 'picture'> & { picture?: ArchivePicture };
type ArchiveState = Omit<AppBackup['state'], 'store'> & { store: Omit<StoreBackup['store'], 'products'> & { products: ArchiveProduct[] } };
type ArchiveFile = { name: string; bytes: Uint8Array };

function mimeTypeFor(uri: string) {
  const extension = uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function extensionFor(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'jpg';
}

function utf8(value: string) {
  return new TextEncoder().encode(value);
}

function textFromBytes(value: Uint8Array) {
  return new TextDecoder().decode(value);
}

function concatBytes(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => { result.set(chunk, offset); offset += chunk.length; });
  return result;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function base64ToBytes(value: string) {
  const input = value.replace(/\s/g, '');
  if (!input || input.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input)) throw new Error('invalid-archive-data');
  const padding = input.endsWith('==') ? 2 : input.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((input.length / 4) * 3 - padding);
  let buffer = 0;
  let bits = 0;
  let offset = 0;
  for (const character of input) {
    if (character === '=') break;
    const code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.indexOf(character);
    buffer = (buffer << 6) | code;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[offset] = (buffer >> bits) & 0xff;
      offset += 1;
    }
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
    result += alphabet[first >> 2];
    result += alphabet[((first & 3) << 4) | (second >> 4)];
    result += index + 1 < bytes.length ? alphabet[((second & 15) << 2) | (third >> 6)] : '=';
    result += index + 2 < bytes.length ? alphabet[third & 63] : '=';
  }
  return result;
}

function zip(files: ArchiveFile[]) {
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  files.forEach((file) => {
    const name = utf8(file.name);
    const data = file.bytes;
    const crc = crc32(data);
    const header = new Uint8Array(30 + name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(8, 0, true); view.setUint16(10, 0, true);
    view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true); view.setUint16(26, name.length, true); view.setUint16(28, 0, true);
    header.set(name, 30);
    local.push(header, data);
    const record = new Uint8Array(46 + name.length);
    const recordView = new DataView(record.buffer);
    recordView.setUint32(0, 0x02014b50, true); recordView.setUint16(4, 20, true); recordView.setUint16(6, 20, true); recordView.setUint16(8, 0, true); recordView.setUint16(10, 0, true);
    recordView.setUint32(16, crc, true); recordView.setUint32(20, data.length, true); recordView.setUint32(24, data.length, true); recordView.setUint16(28, name.length, true); recordView.setUint16(30, 0, true); recordView.setUint16(32, 0, true); recordView.setUint16(34, 0, true); recordView.setUint16(36, 0, true); recordView.setUint32(38, 0, true); recordView.setUint32(42, offset, true);
    record.set(name, 46);
    central.push(record);
    offset += header.length + data.length;
  });
  const localBytes = concatBytes(local);
  const centralBytes = concatBytes(central);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, files.length, true); endView.setUint16(10, files.length, true); endView.setUint32(12, centralBytes.length, true); endView.setUint32(16, localBytes.length, true);
  return concatBytes([localBytes, centralBytes, end]);
}

function unzip(bytes: Uint8Array) {
  const files = new Map<string, Uint8Array>();
  let offset = 0;
  while (offset + 30 <= bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset);
    if (view.getUint32(0, true) !== 0x04034b50) break;
    if (view.getUint16(8, true) !== 0) throw new Error('unsupported-archive-compression');
    const compressedSize = view.getUint32(18, true);
    const nameLength = view.getUint16(26, true);
    const extraLength = view.getUint16(28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) throw new Error('invalid-archive');
    const name = textFromBytes(bytes.slice(nameStart, nameStart + nameLength));
    files.set(name, bytes.slice(dataStart, dataEnd));
    offset = dataEnd;
  }
  if (!files.size) throw new Error('invalid-archive');
  return files;
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

export async function createAppBackup(state: FinanceState): Promise<AppBackup> {
  const storeBackup = await createStoreBackup(state.store);
  return { kind: APP_BACKUP_KIND, version: APP_BACKUP_VERSION, exportedAt: new Date().toISOString(), state: { ...state, store: storeBackup.store } };
}

export async function createAppArchive(state: FinanceState): Promise<Uint8Array> {
  const backup = await createAppBackup(state);
  const imageFiles: ArchiveFile[] = [];
  const products: ArchiveProduct[] = backup.state.store.products.map((product, index): ArchiveProduct => {
    if (!product.picture) {
      const { picture: _picture, ...productWithoutPicture } = product;
      return productWithoutPicture;
    }
    const safeId = product.id.replace(/[^a-z0-9_-]/gi, '') || `product-${index + 1}`;
    const path = `images/${safeId}-${index + 1}.${extensionFor(product.picture.mimeType)}`;
    imageFiles.push({ name: path, bytes: base64ToBytes(product.picture.data) });
    const { picture: _picture, ...productWithoutPicture } = product;
    return { ...productWithoutPicture, picture: { mimeType: product.picture.mimeType, path } };
  });
  const archiveState: ArchiveState = { ...backup.state, store: { ...backup.state.store, products } };
  const manifest = { kind: APP_ARCHIVE_KIND, version: APP_ARCHIVE_VERSION, exportedAt: backup.exportedAt, state: archiveState };
  return zip([{ name: 'backup.json', bytes: utf8(JSON.stringify(manifest, null, 2)) }, ...imageFiles]);
}

export function parseStoreBackup(text: string): StoreBackup {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('invalid-store-backup'); }
  if (!isStoreBackup(value)) throw new Error('invalid-store-backup');
  return value;
}

export function parseAppBackup(text: string): AppBackup {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('invalid-app-backup'); }
  if (!isRecord(value) || value.kind !== APP_BACKUP_KIND || value.version !== APP_BACKUP_VERSION || typeof value.exportedAt !== 'string' || !isRecord(value.state)) throw new Error('invalid-app-backup');
  if (!Array.isArray(value.state.accounts) || !Array.isArray(value.state.transactions) || !isStoreBackup({ kind: BACKUP_KIND, version: BACKUP_VERSION, exportedAt: value.exportedAt, store: value.state.store })) throw new Error('invalid-app-backup');
  return value as AppBackup;
}

export function parseAppArchive(base64: string): AppBackup {
  const files = unzip(base64ToBytes(base64));
  const manifestFile = files.get('backup.json');
  if (!manifestFile) throw new Error('invalid-app-archive');
  let value: unknown;
  try { value = JSON.parse(textFromBytes(manifestFile)); } catch { throw new Error('invalid-app-archive'); }
  if (!isRecord(value) || value.kind !== APP_ARCHIVE_KIND || value.version !== APP_ARCHIVE_VERSION || typeof value.exportedAt !== 'string' || !isRecord(value.state) || !isRecord(value.state.store) || !Array.isArray(value.state.store.products)) throw new Error('invalid-app-archive');
  const products = value.state.store.products.map((product) => {
    if (!isRecord(product)) throw new Error('invalid-app-archive');
    const picture = product.picture;
    if (picture === undefined) return product;
    if (!isRecord(picture) || typeof picture.mimeType !== 'string' || typeof picture.path !== 'string' || !picture.path.startsWith('images/')) throw new Error('invalid-app-archive');
    const image = files.get(picture.path);
    if (!image) throw new Error('invalid-app-archive');
    return { ...product, picture: { mimeType: picture.mimeType, data: bytesToBase64(image) } };
  });
  return parseAppBackup(JSON.stringify({ kind: APP_BACKUP_KIND, version: APP_BACKUP_VERSION, exportedAt: value.exportedAt, state: { ...value.state, store: { ...value.state.store, products } } }));
}

export function restoreStoreBackup(backup: StoreBackup): StoreState {
  const products = backup.store.products.map((product) => {
    const { picture, ...productWithoutPicture } = product;
    if (!picture) return productWithoutPicture;
    return { ...productWithoutPicture, picture: `data:${picture.mimeType};base64,${picture.data}` };
  });
  return { ...backup.store, products } as StoreState;
}

// A Store-only backup intentionally leaves personal finances untouched. Remove
// cross-workspace identifiers from the imported copy so deleting an unrelated
// local transfer or transaction can never mutate the restored Store history.
export function isolateStoreBackupForImport(store: StoreState): StoreState {
  return {
    ...store,
    stockMovements: store.stockMovements.map(({ personalTransactionId: _personalTransactionId, ...movement }) => movement),
    cashMovements: store.cashMovements.map(({ transferId: _transferId, personalTransactionId: _personalTransactionId, ...movement }) => movement),
  };
}

export async function restoreStoreBackupToDevice(backup: StoreBackup): Promise<StoreState> {
  const directory = new Directory(Paths.document, 'product-images');
  directory.create({ idempotent: true, intermediates: true });
  const products = await Promise.all(backup.store.products.map(async (product, index) => {
    const { picture, ...productWithoutPicture } = product;
    if (!picture) return productWithoutPicture;
    const safeId = product.id.replace(/[^a-z0-9_-]/gi, '') || `product-${index + 1}`;
    const destination = new File(directory, `${safeId}-${Date.now()}-${index}.${extensionFor(picture.mimeType)}`);
    destination.create({ overwrite: true, intermediates: true });
    destination.write(picture.data, { encoding: 'base64' });
    return { ...productWithoutPicture, picture: destination.uri };
  }));
  return { ...backup.store, products } as StoreState;
}

export async function restoreAppBackupToDevice(backup: AppBackup): Promise<FinanceState> {
  const store = await restoreStoreBackupToDevice({ kind: BACKUP_KIND, version: BACKUP_VERSION, exportedAt: backup.exportedAt, store: backup.state.store });
  return { ...backup.state, store } as FinanceState;
}
