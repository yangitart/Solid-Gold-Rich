import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { C, LIGHT_C, SANS, SERIF, createThemeStyles } from '../theme/luxury';
import Gem, { diamondLevel } from '../components/Gem';

const BOOT_MS = 900;
const BAR_W = 256;
const BOOT_LEVEL_VALUES = [0, 10_000, 1_000_000, 1_000_000_000, 1_000_000_000_000] as const;

// Pantalla de carga. Comparte fondo con la pantalla principal, así que la
// transición no es un corte: la carga se desvanece y la joya aparece encima del
// MISMO negro. Ese detalle es lo que hace que no parezca "otra pantalla".
export default function BootScreen({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const { t } = useTranslation();
  const progress = useSharedValue(0);
  const [percentage, setPercentage] = React.useState(0);
  const [levelIndex, setLevelIndex] = React.useState(0);
  const [minimumElapsed, setMinimumElapsed] = React.useState(false);
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= 600;
  const fit = Math.min(
    isTablet ? 1.16 : 1,
    Math.max(0.78, Math.min(width / 320, (height - 64) / 500)),
  );

  React.useEffect(() => {
    // La barra no va lineal: arranca rápida, se atasca a media altura y remata.
    // Una barra a velocidad constante se lee como falsa al instante.
    progress.value = withTiming(1, {
      duration: BOOT_MS,
      easing: Easing.bezier(0.16, 0.9, 0.3, 1),
    });

  }, [progress]);

  React.useEffect(() => {
    const timers = BOOT_LEVEL_VALUES.slice(1).map((_, index) => setTimeout(
      () => setLevelIndex(index + 1),
      150 + index * 165,
    ));
    return () => timers.forEach(clearTimeout);
  }, []);

  React.useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setPercentage(Math.min(100, Math.round(((Date.now() - startedAt) / BOOT_MS) * 100)));
    }, 55);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => setMinimumElapsed(true), BOOT_MS);
    return () => clearTimeout(timer);
  }, []);

  // Salida: cuando la barra termina, todo el bloque se va hacia arriba y avisa.
  const exit = useSharedValue(0);
  React.useEffect(() => {
    if (!minimumElapsed || !ready) return;
    exit.value = withDelay(
      40,
      withTiming(1, { duration: 180, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );
  }, [exit, minimumElapsed, onDone, ready]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [
      { translateY: interpolate(exit.value, [0, 1], [0, -26]) },
      { scale: fit },
    ],
  }), [fit]);

  const fillStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [0, BAR_W], Extrapolation.CLAMP),
  }));

  // Cabeza de luz que empuja la barra desde delante.
  const headStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.05, 0.95, 1], [0, 1, 1, 0]),
    transform: [{ translateX: interpolate(progress.value, [0, 1], [0, BAR_W], Extrapolation.CLAMP) }],
  }));

  const currentLevelValue = BOOT_LEVEL_VALUES[levelIndex];
  const currentLevel = diamondLevel(currentLevelValue);

  return (
    <Animated.View style={[styles.root, rootStyle]} pointerEvents="none">
      <Text style={styles.kicker} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('app.loading.kicker')}</Text>
      <View style={styles.markStage}>
        <View style={styles.gemScale}><Gem netWorth={currentLevelValue} animateOrbit={false} interactive={false} accessibilityLabel={t(`app.diamonds.${currentLevel.key}`)} /></View>
      </View>
      <Text style={styles.levelLabel}>{t(`app.diamonds.${currentLevel.key}`)}</Text>

      <Text style={styles.brand}>SOLID GOLD RICH</Text>
      <Text style={styles.subtitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{t('app.loading.subtitle')}</Text>

      <View style={styles.statusCard}>
        <View style={styles.statusTop}><Text style={styles.statusLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{t('app.loading.initialization')}</Text><Text style={styles.percentage}>{percentage}%</Text></View>
        <View style={styles.bar}>
          <Animated.View style={[styles.fill, fillStyle]}>
            <LinearGradient colors={[C.goldDeep, C.gold, C.goldLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Animated.View style={[styles.head, headStyle]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = createThemeStyles((C) => {
  const isLight = C === LIGHT_C;
  return StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  kicker: { width: 300, color: 'rgba(233,200,119,0.48)', fontFamily: SANS, fontSize: 9, letterSpacing: 3.2, marginBottom: 18, textAlign: 'center' },
  markStage: { width: 220, height: 190, alignItems: 'center', justifyContent: 'center', marginTop: -8 },
  gemScale: { width: 300, height: 288, transform: [{ scale: 0.62 }], alignItems: 'center', justifyContent: 'center' },
  levelLabel: { minHeight: 18, color: C.goldLight, fontFamily: SANS, fontSize: 9, fontWeight: '700', letterSpacing: 1.8, textAlign: 'center', textTransform: 'uppercase', opacity: 0.72 },
  brand: {
    color: C.gold,
    fontFamily: SERIF,
    fontSize: 19,
    letterSpacing: 5.5,
    marginTop: 8,
    marginBottom: 25,
    // El tracking añade espacio a la DERECHA de la última letra: este margen
    // compensa para que el texto quede ópticamente centrado.
    marginLeft: 5.5,
  },
  subtitle: { width: 300, color: 'rgba(255,244,208,0.38)', fontFamily: SANS, fontSize: 9, letterSpacing: 2.1, marginTop: -15, marginBottom: 12, textAlign: 'center' },
  statusCard: { width: 288, padding: 16, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, shadowColor: '#000', shadowOpacity: isLight ? 0 : 0.28, shadowRadius: isLight ? 0 : 18, shadowOffset: { width: 0, height: isLight ? 0 : 10 }, elevation: isLight ? 0 : 8, marginTop: 12 },
  statusTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusLabel: { flex: 1, minWidth: 0, color: 'rgba(255,244,208,0.58)', fontFamily: SANS, fontSize: 8, letterSpacing: 1.7 },
  percentage: { color: C.gold, fontFamily: SERIF, fontSize: 16 },
  bar: {
    width: BAR_W,
    height: 2,
    backgroundColor: 'rgba(233,200,119,0.14)',
    borderRadius: 2,
    justifyContent: 'center',
  },
  fill: { position: 'absolute', left: 0, height: 2, borderRadius: 2, overflow: 'hidden' },
  head: {
    position: 'absolute',
    left: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.goldLight,
    shadowColor: C.gold,
    shadowOpacity: isLight ? 0 : 1,
    shadowRadius: isLight ? 0 : 8,
    shadowOffset: { width: 0, height: 0 },
  },
  });
});
