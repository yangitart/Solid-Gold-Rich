import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { C, SANS, SERIF } from '../theme/luxury';

const BOOT_MS = 2600;
const BAR_W = 256;

// Las líneas de estado. Son puro teatro — no hay nada que verificar — pero es
// justo el teatro lo que vende la broma: la app se comporta como si validara una
// fortuna antes de dejarte pasar.
const STAGES = [
  'ESTABLISHING SECURE LINE',
  'VERIFYING AVAILABLE FUNDS',
  'APPRAISING THE STONE',
  'ACCESS GRANTED',
];

const BOOT_DIAMONDS = [
  ['#B4B0C0', '#555260', '#23222B'],
  ['#FFFFFF', '#A6E8FF', '#3A6299'],
  ['#FFF7FF', '#FF9ED9', '#8A386F'],
  ['#FFFCEB', '#FFE07A', '#9B4D16'],
] as const;

// Pantalla de carga. Comparte fondo con la pantalla principal, así que la
// transición no es un corte: la carga se desvanece y la joya aparece encima del
// MISMO negro. Ese detalle es lo que hace que no parezca "otra pantalla".
export default function BootScreen({ onDone }: { onDone: () => void }) {
  const progress = useSharedValue(0);
  const spin = useSharedValue(0);
  const evolve = useSharedValue(1);
  const [stage, setStage] = React.useState(0);
  const [percentage, setPercentage] = React.useState(0);

  React.useEffect(() => {
    // La barra no va lineal: arranca rápida, se atasca a media altura y remata.
    // Una barra a velocidad constante se lee como falsa al instante.
    progress.value = withTiming(1, {
      duration: BOOT_MS,
      easing: Easing.bezier(0.16, 0.9, 0.3, 1),
    });

    spin.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.linear }), -1, false);

    const timers = STAGES.map((_, i) =>
      setTimeout(() => setStage(i), (BOOT_MS / STAGES.length) * i),
    );
    return () => timers.forEach(clearTimeout);
  }, [progress, spin]);

  React.useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setPercentage(Math.min(100, Math.round(((Date.now() - startedAt) / BOOT_MS) * 100)));
    }, 55);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    evolve.value = 0;
    evolve.value = withSpring(1, { damping: 10, stiffness: 145, mass: 0.6 });
  }, [evolve, stage]);

  // Salida: cuando la barra termina, todo el bloque se va hacia arriba y avisa.
  const exit = useSharedValue(0);
  React.useEffect(() => {
    exit.value = withDelay(
      BOOT_MS + 280,
      withTiming(1, { duration: 550, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );
  }, [exit, onDone]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [{ translateY: interpolate(exit.value, [0, 1], [0, -26]) }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [0, BAR_W], Extrapolation.CLAMP),
  }));

  // Cabeza de luz que empuja la barra desde delante.
  const headStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.05, 0.95, 1], [0, 1, 1, 0]),
    transform: [{ translateX: interpolate(progress.value, [0, 1], [0, BAR_W], Extrapolation.CLAMP) }],
  }));

  const markStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(spin.value, [0, 1], [45, 405])}deg` },
      { scale: interpolate(progress.value, [0, 1], [0.86, 1]) * interpolate(evolve.value, [0, 0.65, 1], [0.68, 1.12, 1]) },
    ],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(spin.value, [0, 0.5, 1], [0.25, 0.6, 0.25]),
    transform: [{ rotate: `${interpolate(spin.value, [0, 1], [0, -360])}deg` }],
  }));

  return (
    <Animated.View style={[styles.root, rootStyle]} pointerEvents="none">
      <Text style={styles.kicker}>PRIVATE COLLECTION</Text>
      {/* Marca: un rombo hueco girando dentro de un anillo partido */}
      <View style={styles.markStage}>
        <Animated.View style={[styles.ring, ringStyle]} />
        <Animated.View style={[styles.ringFine, ringStyle]} />
        <View style={styles.orbitDot} />
        <Animated.View style={[styles.mark, markStyle]}>
          <LinearGradient
            colors={BOOT_DIAMONDS[stage]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.markCore} />
          <View style={styles.markFacetH} />
          <View style={styles.markFacetV} />
        </Animated.View>
      </View>

      <Text style={styles.brand}>SOLID GOLD RICH</Text>
      <Text style={styles.subtitle}>THE PERSONAL WEALTH OBJECT</Text>
      <View style={styles.securityPill}><View style={styles.securityDot} /><Text style={styles.securityText}>ENCRYPTED · PRIVATE</Text></View>

      <View style={styles.statusCard}>
        <View style={styles.statusTop}><Text style={styles.statusLabel}>VAULT INITIALIZATION</Text><Text style={styles.percentage}>{percentage}%</Text></View>
        <View style={styles.bar}>
          <Animated.View style={[styles.fill, fillStyle]}>
            <LinearGradient colors={[C.goldDeep, C.gold, C.goldLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Animated.View style={[styles.head, headStyle]} />
        </View>
        <View style={styles.stageRow}>{STAGES.map((item, index) => <View key={item} style={[styles.stageDot, index <= stage && styles.stageDotActive]} />)}</View>
        <Text style={styles.stageText}>{STAGES[stage]}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: 'rgba(233,200,119,0.48)', fontFamily: SANS, fontSize: 9, letterSpacing: 3.2, marginBottom: 18 },
  markStage: { width: 144, height: 144, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 126,
    height: 126,
    borderRadius: 63,
    borderWidth: 1,
    borderColor: 'rgba(233,200,119,0.14)',
    borderTopColor: C.gold,
  },
  ringFine: { position: 'absolute', width: 98, height: 98, borderRadius: 49, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.22)', borderBottomColor: 'transparent' },
  orbitDot: { position: 'absolute', top: 8, width: 5, height: 5, borderRadius: 3, backgroundColor: C.goldLight, shadowColor: C.gold, shadowOpacity: 0.9, shadowRadius: 8 },
  mark: {
    width: 54,
    height: 54,
    borderRadius: 7,
    borderWidth: 1.2,
    borderColor: 'rgba(255,244,208,0.75)',
    overflow: 'hidden',
  },
  markCore: { position: 'absolute', left: 13, top: 13, width: 26, height: 26, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,244,208,0.5)', backgroundColor: 'rgba(255,244,208,0.07)' },
  markFacetH: { position: 'absolute', left: 0, right: 0, top: 26, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,244,208,0.34)' },
  markFacetV: { position: 'absolute', top: 0, bottom: 0, left: 26, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,244,208,0.34)' },
  brand: {
    color: C.gold,
    fontFamily: SERIF,
    fontSize: 19,
    letterSpacing: 5.5,
    marginTop: 18,
    marginBottom: 25,
    // El tracking añade espacio a la DERECHA de la última letra: este margen
    // compensa para que el texto quede ópticamente centrado.
    marginLeft: 5.5,
  },
  subtitle: { color: 'rgba(255,244,208,0.38)', fontFamily: SANS, fontSize: 9, letterSpacing: 2.1, marginTop: -15, marginBottom: 12 },
  securityPill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.18)', backgroundColor: 'rgba(233,200,119,0.035)', marginBottom: 22 },
  securityDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.gold },
  securityText: { color: 'rgba(255,244,208,0.42)', fontFamily: SANS, fontSize: 7, letterSpacing: 1.5 },
  statusCard: { width: 288, padding: 16, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.04)', shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  statusTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusLabel: { color: 'rgba(255,244,208,0.58)', fontFamily: SANS, fontSize: 8, letterSpacing: 1.7 },
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
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  stageRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 12 },
  stageDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(233,200,119,0.18)' },
  stageDotActive: { backgroundColor: C.gold },
  stageText: {
    color: 'rgba(233,200,119,0.45)',
    fontFamily: SANS,
    fontSize: 9,
    letterSpacing: 2.8,
    marginTop: 10,
    textAlign: 'center',
  },
});
