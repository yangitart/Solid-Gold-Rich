import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { C, SERIF } from '../theme/luxury';

// El "+$1" que sale disparado del contador en cada toque.
//
// Se autodestruye: al acabar la animación avisa al padre para que lo saque de la
// lista. Sin eso, un usuario dándole rápido acumularía cientos de nodos muertos.
export default function FloatingGain({
  id,
  drift,
  onDone,
}: {
  id: number;
  drift: number;
  onDone: (id: number) => void;
}) {
  const p = useSharedValue(0);

  React.useEffect(() => {
    p.value = withTiming(1, { duration: 950, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(onDone)(id);
    });
  }, [p, id, onDone]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.12, 0.7, 1], [0, 1, 0.9, 0]),
    transform: [
      { translateY: interpolate(p.value, [0, 1], [0, -86]) },
      { translateX: interpolate(p.value, [0, 1], [0, drift]) },
      { scale: interpolate(p.value, [0, 0.2, 1], [0.7, 1.15, 0.95]) },
    ],
  }));

  return (
    <Animated.View style={[styles.wrap, style]} pointerEvents="none">
      <Text style={styles.text}>+$1</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', alignSelf: 'center', top: 0 },
  text: {
    color: C.goldLight,
    fontFamily: SERIF,
    fontSize: 20,
    letterSpacing: 1,
    textShadowColor: 'rgba(233,200,119,0.9)',
    textShadowRadius: 12,
  },
});
