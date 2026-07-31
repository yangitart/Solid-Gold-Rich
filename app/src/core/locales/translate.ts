import i18n from './i18next';

export default function getTranslationKey(key: string) {
  return i18n.t(key);
}
