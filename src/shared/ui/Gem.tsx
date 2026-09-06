import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { createThemeStyles, LIGHT_C } from '@/shared/ui/theme/luxury';

const SIZE = 150;

export const DIAMOND_LEVELS = [
  {
    min: 0,
    key: 'rough',
    name: 'Rough diamond',
    scale: 0.72,
    colors: ['#A8A4B6', '#656273', '#302E3A', '#15151C'],
    glow: 'rgba(190,185,210,0.28)',
    accent: '#CBC7D8',
  },
  {
    min: 1_000,
    key: 'spark',
    name: 'Spark diamond',
    scale: 0.78,
    colors: ['#F8F7FF', '#BBD9FF', '#6872B1', '#292A59'],
    glow: 'rgba(139,168,255,0.32)',
    accent: '#C7D8FF',
  },
  {
    min: 10_000,
    key: 'white',
    name: 'White diamond',
    scale: 0.84,
    colors: ['#FFFFFF', '#DDF7FF', '#9EB5CC', '#445468'],
    glow: 'rgba(207,242,255,0.38)',
    accent: '#E9FBFF',
  },
  {
    min: 100_000,
    key: 'blue',
    name: 'Blue diamond',
    scale: 0.92,
    colors: ['#F1FFFF', '#7DE4FF', '#347FE8', '#172F72'],
    glow: 'rgba(75,189,255,0.42)',
    accent: '#8DEBFF',
  },
  {
    min: 1_000_000,
    key: 'pink',
    name: 'Pink diamond',
    scale: 1.0,
    colors: ['#FFF7FF', '#FFB9E4', '#DF69AC', '#67235F'],
    glow: 'rgba(255,112,198,0.42)',
    accent: '#FFC2E8',
  },
  {
    min: 10_000_000,
    key: 'red',
    name: 'Red diamond',
    scale: 1.08,
    colors: ['#FFF8F4', '#FF8A8F', '#D7254C', '#570D29'],
    glow: 'rgba(255,65,94,0.48)',
    accent: '#FF9A9D',
  },
  {
    min: 100_000_000,
    key: 'black',
    name: 'Black diamond',
    scale: 1.16,
    colors: ['#F7F4FF', '#756F8A', '#252431', '#05050A'],
    glow: 'rgba(155,126,255,0.5)',
    accent: '#BDAAFF',
  },
  {
    min: 1_000_000_000,
    key: 'imperial',
    name: 'Imperial diamond',
    scale: 1.23,
    colors: ['#FFFDF0', '#FFE28A', '#D58B27', '#6C2F0E'],
    glow: 'rgba(255,190,57,0.54)',
    accent: '#FFE59A',
  },
  {
    min: 10_000_000_000,
    key: 'emerald',
    name: 'Emerald titan',
    scale: 1.29,
    colors: ['#F0FFF9', '#65FFD1', '#0F9F7A', '#064137'],
    glow: 'rgba(47,255,191,0.5)',
    accent: '#83FFD9',
  },
  {
    min: 100_000_000_000,
    key: 'cosmic',
    name: 'Cosmic diamond',
    scale: 1.35,
    colors: ['#FFFFFF', '#8BF3FF', '#875CFF', '#24145C'],
    glow: 'rgba(116,91,255,0.6)',
    accent: '#B6A4FF',
  },
  {
    min: 1_000_000_000_000,
    key: 'infinity',
    name: 'Infinity diamond',
    scale: 1.42,
    colors: ['#FFFFFF', '#FFF18C', '#FF72DA', '#624BFF'],
    glow: 'rgba(255,104,222,0.64)',
    accent: '#FFF3A6',
  },
] as const;

export function diamondLevel(netWorth: number) {
  return [...DIAMOND_LEVELS].reverse().find((level) => netWorth >= level.min) ?? DIAMOND_LEVELS[0];
}

function SatelliteDiamond({
  style,
  colors,
  accent,
}: {
  style: StyleProp<ViewStyle>;
  colors: readonly [string, string, string, string];
  accent: string;
}) {
  return (
    <View style={[styles.satellite, style, { borderColor: accent, shadowColor: accent }]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.satelliteTable} />
      <View style={styles.satelliteFacetH} />
      <View style={styles.satelliteFacetV} />
      <View style={[styles.satelliteRim, { borderColor: accent }]} />
    </View>
  );
}

export default function Gem({
  netWorth,
  accessibilityLabel = 'Diamond',
  animateOrbit = true,
  interactive = true,
}: {
  netWorth: number;
  accessibilityLabel?: string;
  animateOrbit?: boolean;
  interactive?: boolean;
}) {
  const level = diamondLevel(netWorth);
  const isMassive = netWorth >= 100_000_000;
  const isCosmic = netWorth >= 10_000_000_000;
  const breathe = useSharedValue(0);
  const sweep = useSharedValue(0);
  const spin = useSharedValue(0);
  const evolve = useSharedValue(1);
  const tap = useSharedValue(0);

  React.useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    sweep.value = withRepeat(
      withTiming(1, { duration: 4600, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false,
    );
    spin.value = withRepeat(withTiming(1, { duration: 22000, easing: Easing.linear }), -1, false);
  }, [breathe, sweep, spin]);

  React.useEffect(() => {
    evolve.value = 0;
    evolve.value = withSpring(1, { damping: 11, stiffness: 135, mass: 0.7 });
  }, [evolve, level.name]);

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(evolve.value, [0, 0.3, 1], [0.35, 1, 1]),
    transform: [
      { rotate: '45deg' },
      {
        scale:
          level.scale *
          interpolate(evolve.value, [0, 0.62, 1], [0.76, 1.08, 1]) *
          interpolate(breathe.value, [0, 1], [1, 1.025]),
      },
    ],
  }));
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sweep.value, [0, 0.05, 0.38, 0.44, 1], [0, 0.95, 0.95, 0, 0]),
    transform: [
      { translateX: interpolate(sweep.value, [0, 0.44, 1], [-SIZE * 1.2, SIZE * 1.6, SIZE * 1.6]) },
      { rotate: '18deg' },
    ],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(breathe.value, [0, 1], [0.52, 0.92]) *
      interpolate(evolve.value, [0, 1], [0.3, 1]),
    transform: [{ scale: level.scale * interpolate(breathe.value, [0, 1], [0.95, 1.14]) }],
  }));
  const ringStyle = useAnimatedStyle(
    () => ({
      transform: [
        { rotate: `${animateOrbit ? interpolate(spin.value, [0, 1], [0, 360]) : 0}deg` },
        { scale: interpolate(evolve.value, [0, 1], [0.82, 1]) },
      ],
    }),
    [animateOrbit],
  );
  const ringReverseStyle = useAnimatedStyle(
    () => ({
      transform: [
        { rotate: `${animateOrbit ? interpolate(spin.value, [0, 1], [0, -360]) : 0}deg` },
        { scale: 1.2 },
      ],
    }),
    [animateOrbit],
  );
  const burstStyle = useAnimatedStyle(() => ({
    opacity: interpolate(evolve.value, [0, 0.16, 1], [0.8, 0.6, 0]),
    transform: [{ scale: interpolate(evolve.value, [0, 1], [0.55, 1.9]) }],
  }));

  const tapStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(tap.value, [0, 1], [0, -15]) },
      { rotate: `${interpolate(tap.value, [0, 1], [0, 4])}deg` },
      { scale: interpolate(tap.value, [0, 1], [1, 1.055]) },
    ],
  }));

  const handlePress = React.useCallback(() => {
    tap.value = withSequence(
      withTiming(1, { duration: 90, easing: Easing.out(Easing.cubic) }),
      withSpring(0, { damping: 7, stiffness: 210, mass: 0.55 }),
    );
    evolve.value = 0;
    evolve.value = withSpring(1, { damping: 9, stiffness: 165, mass: 0.6 });
  }, [evolve, tap]);

  return (
    <Pressable
      style={styles.stage}
      onPress={interactive ? handlePress : undefined}
      disabled={!interactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[styles.stageContent, tapStyle]} pointerEvents="none">
        <Animated.View style={[styles.halo, haloStyle]}>
          <LinearGradient
            colors={[level.glow, 'rgba(113,89,190,0.08)', 'transparent']}
            style={styles.haloFill}
          />
        </Animated.View>
        <View style={styles.floorShadow} />
        <Animated.View style={[styles.burst, { borderColor: level.accent }, burstStyle]} />
        <Animated.View style={[styles.ring, { borderTopColor: level.accent }, ringStyle]} />
        <Animated.View
          style={[
            styles.ring,
            styles.ringOuter,
            { borderBottomColor: level.accent },
            ringReverseStyle,
          ]}
        />
        {isMassive && (
          <Animated.View style={[styles.crownRing, { borderColor: level.accent }, ringStyle]} />
        )}

        <Animated.View style={[styles.body, { shadowColor: level.accent }, bodyStyle]}>
          <LinearGradient
            colors={level.colors}
            locations={[0, 0.32, 0.68, 1]}
            start={{ x: 0.05, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.facets}>
            <LinearGradient
              colors={['rgba(255,255,255,0.72)', 'rgba(255,255,255,0.02)']}
              style={styles.quad}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.28)', 'rgba(8,10,34,0.36)']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.quad}
            />
            <LinearGradient
              colors={['rgba(8,9,31,0.42)', 'rgba(255,255,255,0.2)']}
              style={styles.quad}
            />
            <LinearGradient
              colors={['rgba(5,6,24,0.48)', 'rgba(255,255,255,0.24)']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.quad}
            />
          </View>
          <View style={styles.innerTable}>
            <LinearGradient
              colors={['rgba(255,255,255,0.48)', 'rgba(255,255,255,0.04)', 'rgba(15,12,45,0.22)']}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={[styles.facetLine, styles.lineVertical]} />
          <View style={[styles.facetLine, styles.lineHorizontal]} />
          <View style={[styles.facetLine, styles.lineDiagonalA]} />
          <View style={[styles.facetLine, styles.lineDiagonalB]} />
          <Animated.View style={[styles.sweep, sweepStyle]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.92)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <View style={[styles.rim, { borderColor: level.accent }]} />
        </Animated.View>

        <View style={[styles.sparkle, styles.sparkleTop, { backgroundColor: level.accent }]}>
          <View style={[styles.sparkleCross, { backgroundColor: level.accent }]} />
        </View>
        <View style={[styles.sparkle, styles.sparkleRight, { backgroundColor: level.accent }]}>
          <View style={[styles.sparkleCross, { backgroundColor: level.accent }]} />
        </View>
        {isMassive && (
          <>
            <SatelliteDiamond
              style={styles.satelliteLeft}
              colors={level.colors}
              accent={level.accent}
            />
            <SatelliteDiamond
              style={styles.satelliteRight}
              colors={level.colors}
              accent={level.accent}
            />
          </>
        )}
        {isCosmic && (
          <>
            <View style={[styles.ray, styles.rayHorizontal, { backgroundColor: level.accent }]} />
            <View style={[styles.ray, styles.rayVertical, { backgroundColor: level.accent }]} />
            <SatelliteDiamond
              style={styles.satelliteTop}
              colors={level.colors}
              accent={level.accent}
            />
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = createThemeStyles((C) => {
  const isLight = C === LIGHT_C;
  return StyleSheet.create({
    stage: { width: 300, height: 288, alignItems: 'center', justifyContent: 'center' },
    stageContent: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    halo: { position: 'absolute', width: 290, height: 290, borderRadius: 145 },
    haloFill: { flex: 1, borderRadius: 145 },
    floorShadow: isLight
      ? { display: 'none' }
      : {
          position: 'absolute',
          bottom: 28,
          width: 142,
          height: 18,
          borderRadius: 70,
          backgroundColor: 'rgba(0,0,0,0.52)',
          transform: [{ scaleX: 1.35 }],
        },
    burst: { position: 'absolute', width: 172, height: 172, borderRadius: 86, borderWidth: 1.2 },
    ring: {
      position: 'absolute',
      width: 232,
      height: 232,
      borderRadius: 116,
      borderWidth: 1,
      borderColor: 'rgba(226,220,255,0.14)',
      borderLeftColor: 'transparent',
    },
    ringOuter: { borderColor: 'rgba(226,220,255,0.08)', borderRightColor: 'transparent' },
    crownRing: {
      position: 'absolute',
      width: 270,
      height: 270,
      borderRadius: 135,
      borderWidth: StyleSheet.hairlineWidth,
      borderStyle: 'dashed',
      opacity: 0.38,
    },
    body: {
      width: SIZE,
      height: SIZE,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: C.goldMid,
      shadowOpacity: isLight ? 0 : 0.78,
      shadowRadius: isLight ? 0 : 32,
      shadowOffset: { width: 0, height: 0 },
      elevation: isLight ? 0 : 22,
    },
    facets: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', flexWrap: 'wrap' },
    quad: { width: '50%', height: '50%' },
    innerTable: {
      position: 'absolute',
      left: 37,
      top: 37,
      width: 76,
      height: 76,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.38)',
      overflow: 'hidden',
    },
    facetLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.25)' },
    lineVertical: { left: '50%', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
    lineHorizontal: { top: '50%', left: 0, right: 0, height: StyleSheet.hairlineWidth },
    lineDiagonalA: {
      left: 75,
      top: -32,
      width: StyleSheet.hairlineWidth,
      height: 214,
      transform: [{ rotate: '45deg' }],
    },
    lineDiagonalB: {
      left: 75,
      top: -32,
      width: StyleSheet.hairlineWidth,
      height: 214,
      transform: [{ rotate: '-45deg' }],
    },
    sweep: { position: 'absolute', top: -SIZE, bottom: -SIZE, width: 42 },
    rim: { ...StyleSheet.absoluteFillObject, borderRadius: 12, borderWidth: 1.4, opacity: 0.7 },
    sparkle: {
      position: 'absolute',
      width: 2,
      height: 20,
      borderRadius: 2,
      shadowColor: '#FFFFFF',
      shadowOpacity: isLight ? 0 : 0.9,
      shadowRadius: isLight ? 0 : 7,
    },
    sparkleCross: { position: 'absolute', width: 12, height: 2, left: -5, top: 9, borderRadius: 2 },
    sparkleTop: { top: 48, right: 67, transform: [{ scale: 0.75 }] },
    sparkleRight: { top: 112, right: 34, transform: [{ scale: 0.42 }] },
    satellite: {
      position: 'absolute',
      width: 24,
      height: 24,
      borderRadius: 4,
      borderWidth: 1.2,
      overflow: 'hidden',
      transform: [{ rotate: '45deg' }],
      shadowOpacity: isLight ? 0 : 0.9,
      shadowRadius: isLight ? 0 : 9,
      shadowOffset: { width: 0, height: 0 },
      elevation: isLight ? 0 : 8,
    },
    satelliteTable: {
      position: 'absolute',
      left: 6,
      top: 6,
      width: 10,
      height: 10,
      borderRadius: 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.55)',
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    satelliteFacetH: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 11,
      height: StyleSheet.hairlineWidth,
      backgroundColor: 'rgba(255,255,255,0.45)',
    },
    satelliteFacetV: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 11,
      width: StyleSheet.hairlineWidth,
      backgroundColor: 'rgba(255,255,255,0.45)',
    },
    satelliteRim: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 4,
      borderWidth: StyleSheet.hairlineWidth,
      opacity: 0.8,
    },
    satelliteLeft: { left: 24, top: 126 },
    satelliteRight: { right: 25, bottom: 58, transform: [{ rotate: '45deg' }, { scale: 0.72 }] },
    satelliteTop: { top: 22, left: 63, transform: [{ rotate: '45deg' }, { scale: 0.58 }] },
    ray: { position: 'absolute', opacity: 0.13, borderRadius: 2 },
    rayHorizontal: { width: 292, height: 1 },
    rayVertical: { width: 1, height: 278 },
  });
});
