import { Platform } from 'react-native';

// Paleta única de la app: obsidiana + oro. Todo el resto de componentes tira de
// aquí para que no haya dos dorados distintos peleándose en pantalla.
export const C = {
  void: '#04050A', // fondo, casi negro
  ink: '#0A0C14', // superficies elevadas
  goldLight: '#FFF4D0', // brillo especular
  gold: '#E9C877', // oro principal
  goldMid: '#C9A24D',
  goldDeep: '#8A6A22',
  goldDark: '#4A3712',
  green: '#B7AD84', // positivo neutro, integrado con la paleta champagne
  red: '#F08B88',
  line: 'rgba(233,200,119,0.22)', // hairlines de las tarjetas
  glass: 'rgba(255,255,255,0.04)',
} as const;

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
