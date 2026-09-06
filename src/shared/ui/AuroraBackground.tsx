import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { C, LIGHT_C, createThemeStyles, getThemeColors } from '@/shared/ui/theme/luxury';

// Fondo vivo: dos manchas doradas enormes y muy difusas que respiran y giran a
// distinta velocidad. Al desfasarse entre ellas la luz nunca repite el mismo
// patrón, que es lo que hace que el negro no se vea muerto.
//
// Todo se mueve desde DOS shared values (no uno por capa): el trabajo ocurre en
// el hilo de UI y el JS se queda a cero durante toda la animación.
export default function AuroraBackground() {
  const slow = useSharedValue(0);
  const fast = useSharedValue(0);
  const lightMode = getThemeColors().void === LIGHT_C.void;

  React.useEffect(() => {
    slow.value = withRepeat(
      withTiming(1, { duration: 18000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    fast.value = withRepeat(
      withTiming(1, { duration: 11000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [slow, fast]);

  const blobA = useAnimatedStyle(() => ({
    opacity: interpolate(slow.value, [0, 1], [0.5, 0.85]),
    transform: [
      { translateX: interpolate(slow.value, [0, 1], [-40, 40]) },
      { translateY: interpolate(slow.value, [0, 1], [-30, 20]) },
      { scale: interpolate(slow.value, [0, 1], [1, 1.25]) },
      { rotate: `${interpolate(slow.value, [0, 1], [0, 45])}deg` },
    ],
  }));

  const blobB = useAnimatedStyle(() => ({
    opacity: interpolate(fast.value, [0, 1], [0.35, 0.6]),
    transform: [
      { translateX: interpolate(fast.value, [0, 1], [50, -50]) },
      { translateY: interpolate(fast.value, [0, 1], [40, -20]) },
      { scale: interpolate(fast.value, [0, 1], [1.2, 0.9]) },
      { rotate: `${interpolate(fast.value, [0, 1], [0, -60])}deg` },
    ],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: C.background }]} />

      <Animated.View style={[styles.blob, styles.blobTop, blobA]}>
        <LinearGradient
          colors={
            lightMode
              ? ['rgba(233,200,119,0.18)', 'rgba(138,106,34,0.06)', 'rgba(247,243,234,0)']
              : ['rgba(233,200,119,0.30)', 'rgba(138,106,34,0.10)', 'rgba(4,5,10,0)']
          }
          style={styles.fill}
        />
      </Animated.View>

      <Animated.View style={[styles.blob, styles.blobBottom, blobB]}>
        <LinearGradient
          colors={
            lightMode
              ? ['rgba(201,162,77,0.14)', 'rgba(74,55,18,0.04)', 'rgba(247,243,234,0)']
              : ['rgba(201,162,77,0.22)', 'rgba(74,55,18,0.08)', 'rgba(4,5,10,0)']
          }
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.fill}
        />
      </Animated.View>

      {/* Viñeta: oscurece los bordes para que la mirada caiga en el centro. */}
      <LinearGradient
        colors={
          lightMode
            ? [
                'rgba(247,243,234,0.28)',
                'rgba(247,243,234,0)',
                'rgba(247,243,234,0)',
                'rgba(247,243,234,0.34)',
              ]
            : ['rgba(4,5,10,0.95)', 'rgba(4,5,10,0)', 'rgba(4,5,10,0)', 'rgba(4,5,10,0.98)']
        }
        locations={[0, 0.28, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = createThemeStyles((C) =>
  StyleSheet.create({
    blob: {
      position: 'absolute',
      width: 520,
      height: 520,
      borderRadius: 260,
      overflow: 'hidden',
    },
    blobTop: { top: -110, alignSelf: 'center' },
    blobBottom: { bottom: -160, left: -120 },
    fill: { flex: 1, borderRadius: 260 },
  }),
);
