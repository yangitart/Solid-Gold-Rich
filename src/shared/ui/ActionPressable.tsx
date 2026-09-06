import React from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Brief touch feedback; it never delays the action or animates in a loop.
export default function ActionPressable({
  style,
  onPressIn,
  onPressOut,
  disabled,
  ...props
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const scale = React.useRef(new Animated.Value(1)).current;
  const animate = (value: number) => {
    scale.stopAnimation();
    if (reduceMotion || disabled) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, {
      toValue: value,
      duration: value === 1 ? 140 : 85,
      useNativeDriver: true,
    }).start();
  };
  React.useEffect(() => {
    if (disabled || reduceMotion) scale.setValue(1);
  }, [disabled, reduceMotion, scale]);
  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      style={[style, { transform: [{ scale }] }]}
      onPressIn={(event) => {
        animate(0.97);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animate(1);
        onPressOut?.(event);
      }}
    />
  );
}
