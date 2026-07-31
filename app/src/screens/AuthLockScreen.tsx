import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { C, SANS, SERIF } from '../theme/luxury';

export default function AuthLockScreen({ onUnlock }: { onUnlock: () => Promise<boolean> }) {
  const glow = useSharedValue(0);
  const [busy, setBusy] = React.useState(false);
  const prompted = React.useRef(false);

  const tryUnlock = React.useCallback(async () => {
    if (busy) return;
    setBusy(true);
    await onUnlock();
    setBusy(false);
  }, [busy, onUnlock]);

  React.useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
    if (!prompted.current) {
      prompted.current = true;
      void tryUnlock();
    }
  }, [glow, tryUnlock]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.24 + glow.value * 0.25,
    transform: [{ scale: 0.92 + glow.value * 0.1 }],
  }));

  return (
    <SafeAreaView style={styles.root}>
      <Animated.View style={[styles.glow, glowStyle]} />
      <View style={styles.lockCircle}><View style={styles.lockShackle} /><View style={styles.lockBody}><View style={styles.lockKeyhole} /></View></View>
      <Text style={styles.eyebrow}>PRIVATE VAULT</Text>
      <Text style={styles.title}>VAULT LOCKED</Text>
      <Text style={styles.copy}>Confirm your identity to reveal your personal wealth object.</Text>
      <Pressable style={styles.button} onPress={tryUnlock} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? 'WAITING FOR DEVICE...' : 'UNLOCK WITH BIOMETRICS'}</Text>
      </Pressable>
      <Text style={styles.hint}>Fingerprint, face or device PIN</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.void, paddingHorizontal: 32 },
  glow: { position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: C.goldDeep },
  lockCircle: { width: 116, height: 116, borderRadius: 58, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  lockShackle: { position: 'absolute', top: 29, width: 32, height: 28, borderWidth: 4, borderBottomWidth: 0, borderColor: C.gold, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  lockBody: { width: 46, height: 38, marginTop: 22, borderRadius: 8, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  lockKeyhole: { width: 7, height: 11, borderRadius: 4, backgroundColor: C.goldDark },
  eyebrow: { color: 'rgba(233,200,119,0.52)', fontFamily: SANS, fontSize: 9, letterSpacing: 3.2 },
  title: { color: C.goldLight, fontFamily: SERIF, fontSize: 34, letterSpacing: 4, marginTop: 10 },
  copy: { maxWidth: 270, color: 'rgba(255,244,208,0.44)', fontFamily: SANS, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 14 },
  button: { width: 270, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(233,200,119,0.10)', marginTop: 28 },
  buttonText: { color: C.goldLight, fontFamily: SANS, fontSize: 9, letterSpacing: 1.7 },
  hint: { color: 'rgba(255,244,208,0.28)', fontFamily: SANS, fontSize: 10, letterSpacing: 1, marginTop: 12 },
});
