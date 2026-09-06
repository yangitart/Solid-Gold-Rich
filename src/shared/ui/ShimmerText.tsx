import React from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { createThemeStyles } from '@/shared/ui/theme/luxury';

const WINDOW = 120; // ancho de la ventana de brillo

// Texto en oro con un reflejo que recorre las letras.
//
// El truco: se pinta el texto dos veces. La copia de arriba va dentro de una
// ventana estrecha con `overflow: hidden` que se desplaza; el texto de dentro se
// desplaza en sentido CONTRARIO exactamente lo mismo, así se queda quieto en
// pantalla y lo único que se mueve es el recorte. El brillo cae sobre los
// glifos, no sobre un rectángulo — que es lo que delata a los shimmers baratos.
export default function ShimmerText({
  children,
  style,
  delay = 0,
  adjustsFontSizeToFit,
  minimumFontScale,
  numberOfLines,
}: {
  children: string;
  style?: TextStyle;
  delay?: number;
  adjustsFontSizeToFit?: boolean;
  minimumFontScale?: number;
  numberOfLines?: number;
}) {
  const [w, setW] = React.useState(0);
  const p = useSharedValue(0);

  React.useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.quad) }), -1, false),
    );
  }, [p, delay]);

  const travel = w + WINDOW;

  const windowStyle = useAnimatedStyle(() => ({
    // Igual que en la gema: el reflejo cruza en la primera mitad del ciclo y
    // luego hay pausa. Sin pausa el texto parece un banner publicitario.
    opacity: interpolate(p.value, [0, 0.04, 0.5, 0.56, 1], [0, 1, 1, 0, 0]),
    transform: [{ translateX: interpolate(p.value, [0, 0.55, 1], [-WINDOW, travel, travel]) }],
  }));

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -interpolate(p.value, [0, 0.55, 1], [-WINDOW, travel, travel]) }],
  }));

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Text
        style={[styles.base, style]}
        adjustsFontSizeToFit={adjustsFontSizeToFit}
        minimumFontScale={minimumFontScale}
        numberOfLines={numberOfLines}
      >
        {children}
      </Text>

      {w > 0 && (
        <Animated.View style={[styles.window, windowStyle]} pointerEvents="none">
          <Animated.View style={innerStyle}>
            <Text
              style={[styles.base, style, styles.shine, { width: w }]}
              adjustsFontSizeToFit={adjustsFontSizeToFit}
              minimumFontScale={minimumFontScale}
              numberOfLines={numberOfLines}
            >
              {children}
            </Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = createThemeStyles((C) =>
  StyleSheet.create({
    base: { color: C.gold },
    window: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: WINDOW,
      overflow: 'hidden',
    },
    shine: { color: '#FFFFFF' },
  }),
);
