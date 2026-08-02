import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { C, SANS, SERIF } from '../theme/luxury';
import { useTranslation } from 'react-i18next';

// El certificado de autenticidad. Cristal esmerilado, hairline dorada y un
// reflejo lento que cruza la tarjeta en diagonal, como el holograma de una
// tarjeta metálica de verdad.
export default function CertificateCard({ serial }: { serial: string }) {
  const { t } = useTranslation();
  const glare = useSharedValue(0);

  React.useEffect(() => {
    glare.value = withRepeat(
      withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false,
    );
  }, [glare]);

  const glareStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glare.value, [0, 0.06, 0.42, 0.5, 1], [0, 0.9, 0.9, 0, 0]),
    transform: [
      { translateX: interpolate(glare.value, [0, 0.5, 1], [-260, 380, 380]) },
      { rotate: '22deg' },
    ],
  }));

  return (
    <View style={styles.wrap}>
      <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.01)']}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.glare, glareStyle]} pointerEvents="none">
        <LinearGradient
          colors={['transparent', 'rgba(255,244,208,0.16)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={styles.row}>
        <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t('app.certificate.title')}</Text>
        <Text style={styles.karat}>{t('app.certificate.karat')}</Text>
      </View>

      <View style={styles.rule} />

      <View style={styles.row}>
        <Text style={styles.key}>{t('app.certificate.serial')}</Text>
        <Text style={styles.value}>{serial}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.key}>{t('app.certificate.edition')}</Text>
        <Text style={styles.value}>{t('app.certificate.oneOfOne')}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.key}>{t('app.certificate.utility')}</Text>
        <Text style={styles.value}>{t('app.certificate.infinite')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 300,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    overflow: 'hidden',
    backgroundColor: 'rgba(10,12,20,0.55)',
  },
  glare: { position: 'absolute', top: -80, bottom: -80, width: 90 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 3,
  },
  label: { flex: 1, minWidth: 0, color: C.gold, fontFamily: SANS, fontSize: 10, letterSpacing: 2.4 },
  karat: { color: C.goldLight, fontFamily: SERIF, fontSize: 15, letterSpacing: 1 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginVertical: 12 },
  key: {
    color: 'rgba(255,244,208,0.42)',
    fontFamily: SANS,
    fontSize: 11,
    letterSpacing: 1.4,
  },
  value: { color: C.goldLight, fontFamily: SANS, fontSize: 11, letterSpacing: 1.4 },
});
