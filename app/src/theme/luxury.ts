import { Platform, StyleSheet } from 'react-native';

export type ThemeMode = 'dark' | 'light';

export type ThemeColors = {
  void: string;
  background: string;
  ink: string;
  goldLight: string;
  gold: string;
  goldMid: string;
  goldDeep: string;
  goldDark: string;
  green: string;
  red: string;
  line: string;
  glass: string;
  text: string;
  textMuted: string;
  textSubtle: string;
};

const DARK_C: ThemeColors = {
  void: '#04050A', // fondo, casi negro
  background: '#04050A',
  ink: '#0A0C14', // superficies elevadas
  goldLight: '#FFF4D0', // brillo especular
  gold: '#E9C877', // oro principal
  goldMid: '#C9A24D',
  goldDeep: '#8A6A22',
  goldDark: '#4A3712',
  green: '#B7AD84', // positivo neutro, integrado con la paleta champagne
  red: '#F08B88',
  line: 'rgba(233,200,119,0.22)', // hairlines de las tarjetas
  glass: 'rgba(233,200,119,0.07)',
  text: '#FFF4D0',
  textMuted: 'rgba(255,244,208,0.62)',
  textSubtle: 'rgba(255,244,208,0.42)',
} as const;

export const LIGHT_C: ThemeColors = {
  void: '#241F16',
  background: '#F7F3EA',
  ink: '#FFFDF8',
  goldLight: '#5D4511',
  gold: '#9B741C',
  goldMid: '#B58A2F',
  goldDeep: '#765611',
  goldDark: '#E3C77F',
  green: '#467A5B',
  red: '#B94E4E',
  line: 'rgba(95,68,17,0.20)',
  glass: 'rgba(155,116,28,0.08)',
  text: '#241F16',
  textMuted: 'rgba(36,31,22,0.68)',
  textSubtle: 'rgba(36,31,22,0.48)',
};

let activeThemeMode: ThemeMode = 'dark';

export const C: ThemeColors = new Proxy(DARK_C, {
  get: (_target, property: string | symbol) => getThemeColors()[property as keyof ThemeColors],
});

export function setThemeMode(mode: ThemeMode) {
  activeThemeMode = mode;
}

export function getThemeColors() {
  return activeThemeMode === 'light' ? LIGHT_C : DARK_C;
}

export function createThemeStyles<T extends Record<string, unknown>>(
  factory: (colors: ThemeColors) => T,
): T {
  const buildLightStyles = () => {
    const created = factory(LIGHT_C);
    const flattened = Object.fromEntries(
      Object.entries(created).map(([key, style]) => [key, StyleSheet.flatten(style as never)]),
    );
    return StyleSheet.create(remapLightStyles(flattened) as never) as T;
  };
  const cache = {
    dark: factory(DARK_C),
    light: buildLightStyles(),
  } as Record<ThemeMode, T>;
  return new Proxy({} as T, {
    get: (_target, property: string | symbol) => cache[activeThemeMode][property as keyof T],
  });
}

function remapLightStyles(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(remapLightStyles);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, remapLightStyles(item)]),
    );
  }
  if (typeof value !== 'string') return value;

  if (value === '#0A0C14') return LIGHT_C.ink;
  if (value === '#090B12' || value === '#11141D') return LIGHT_C.ink;
  if (value === '#F08B88') return LIGHT_C.red;
  if (value === '#FFFFFF') return LIGHT_C.text;

  const match = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(value);
  if (!match) return value;
  const [, red, green, blue, alpha] = match;
  const rgb = `${red},${green},${blue}`;
  const a = Number(alpha);
  if (rgb === '255,244,208' || rgb === '255,255,255') {
    // Las superficies blancas muy tenues desaparecen sobre crema: reforzarlas.
    const nextAlpha = a <= 0.12 ? Math.min(0.16, a * 3) : a;
    return `rgba(36,31,22,${nextAlpha})`;
  }
  if (rgb === '233,200,119') return `rgba(122,90,20,${a})`;
  if (rgb === '0,0,0') return `rgba(45,36,20,${Math.min(0.45, a * 0.6)})`;
  if (rgb === '4,5,10') return `rgba(247,243,234,${a})`;
  if (rgb === '10,12,20') return LIGHT_C.ink;
  if (rgb === '9,11,18') return LIGHT_C.ink;
  if (rgb === '22,13,17') return '#FFF1F0';
  return value;
}

// Serif para los titulares (aire de casa de subastas). No cargamos ninguna
// fuente propia: se empaqueta 0 KB y arranca instantáneo.
export const SERIF = Platform.select({
  ios: 'Didot',
  android: 'serif',
  default: 'Georgia, "Times New Roman", serif',
});

// Sans con mucho tracking para los micro-textos (CERTIFIED, 24K...).
export const SANS = Platform.select({
  ios: 'Avenir Next',
  android: 'sans-serif',
  default: 'Helvetica Neue, Arial, sans-serif',
});
