import React from 'react';
import { DimensionValue, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { C } from '../theme/luxury';

const COUNT = 16; // tope deliberado: más motas no se ven mejor, solo van peor

// Una mota de polvo de oro. Sube, se balancea en horizontal y se desvanece en
// los dos extremos del recorrido para que nunca se vea "aparecer" ni "cortarse".
function Mote({ index, height }: { index: number; height: number }) {
  const p = useSharedValue(0);

  // Valores fijos por mota: pseudoaleatorios pero deterministas, así no cambian
  // en cada render y no hace falta guardarlos en estado.
  const seed = (index * 9301 + 49297) % 233280;
  const rnd = seed / 233280;
  const size = 1.5 + rnd * 3;
  const left: DimensionValue = `${(index * 6.3 + rnd * 30) % 96}%`;
  const drift = (rnd - 0.5) * 70;
  const duration = 9000 + rnd * 9000;

  React.useEffect(() => {
    p.value = withDelay(
      index * 620,
      withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false),
    );
  }, [p, index, duration]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.12, 0.8, 1], [0, 0.9, 0.55, 0]),
    transform: [
      { translateY: interpolate(p.value, [0, 1], [height * 0.95, -60]) },
      { translateX: interpolate(p.value, [0, 0.5, 1], [0, drift, 0]) },
      { scale: interpolate(p.value, [0, 0.5, 1], [0.6, 1, 0.5]) },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.mote,
        {
          left,
          width: size,
          height: size,
          borderRadius: size,
          shadowRadius: size * 3,
        },
        style,
      ]}
    />
  );
}

export default function GoldDust() {
  const { height } = useWindowDimensions();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: COUNT }, (_, i) => (
        <Mote key={i} index={i} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  mote: {
    position: 'absolute',
    top: 0,
    backgroundColor: C.goldLight,
    shadowColor: C.gold,
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
  },
});
