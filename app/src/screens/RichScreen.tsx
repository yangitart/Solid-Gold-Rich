import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  SharedValue,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Gem, { diamondLevel, DIAMOND_LEVELS } from '../components/Gem';
import ShimmerText from '../components/ShimmerText';
import CertificateCard from '../components/CertificateCard';
import { C, SANS, SERIF } from '../theme/luxury';

const ENTER_MS = 1800;
const NET_WORTH_KEY = '@im-rich/net-worth';

function useStage(enter: SharedValue<number>, from: number, to: number, lift = 18) {
  return useAnimatedStyle(() => {
    const t = interpolate(enter.value, [from, to], [0, 1], Extrapolation.CLAMP);
    return { opacity: t, transform: [{ translateY: interpolate(t, [0, 1], [lift, 0]) }] };
  });
}

function parseNetWorth(value: string) {
  const amount = Number(value.replace(/[^0-9]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
}

export default function RichScreen({
  authEnabled,
  onToggleAuth,
}: {
  authEnabled: boolean;
  onToggleAuth: () => Promise<boolean>;
}) {
  const enter = useSharedValue(0);
  const [netWorthInput, setNetWorthInput] = React.useState('0');
  const [authBusy, setAuthBusy] = React.useState(false);
  const netWorth = parseNetWorth(netWorthInput);
  const level = diamondLevel(netWorth);
  const loaded = React.useRef(false);
  const { height } = useWindowDimensions();
  const fit = Math.min(1, Math.max(0.74, height / 820));
  const serial = React.useRef(`IR-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(Math.random() * 9000 + 1000)}`).current;

  React.useEffect(() => {
    enter.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
  }, [enter]);

  React.useEffect(() => {
    AsyncStorage.getItem(NET_WORTH_KEY).then((savedValue) => {
      if (savedValue !== null) setNetWorthInput(savedValue);
      loaded.current = true;
    });
  }, []);

  React.useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(NET_WORTH_KEY, netWorthInput).catch(() => undefined);
  }, [netWorthInput]);

  const handleAuthToggle = React.useCallback(async () => {
    if (authBusy) return;
    setAuthBusy(true);
    await onToggleAuth();
    setAuthBusy(false);
  }, [authBusy, onToggleAuth]);

  const sTop = useStage(enter, 0.0, 0.3, 12);
  const sGem = useStage(enter, 0.12, 0.55, 26);
  const sTitle = useStage(enter, 0.42, 0.72, 22);
  const sValue = useStage(enter, 0.56, 0.82, 18);
  const sCard = useStage(enter, 0.7, 0.94, 24);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={[styles.stack, { transform: [{ scale: fit }] }]}>
          <Animated.View style={[styles.header, sTop]}>
            <View style={styles.hairline} />
            <Text style={styles.eyebrow}>YOUR PERSONAL VAULT</Text>
            <View style={styles.hairline} />
            <Pressable
              style={[styles.authMini, authEnabled && styles.authMiniEnabled]}
              onPress={handleAuthToggle}
              disabled={authBusy}
              accessibilityLabel={authEnabled ? 'Disable device authentication' : 'Add device authentication'}
            >
              <View style={[styles.authMiniBody, authEnabled && styles.authMiniEnabledPart]} />
              <View style={[styles.authMiniTop, authEnabled && styles.authMiniEnabledPart]} />
            </Pressable>
          </Animated.View>
          <Animated.View style={[styles.gemWrap, sGem]}><Gem netWorth={netWorth} /></Animated.View>
          <Animated.View style={[styles.center, sTitle]}>
            <ShimmerText style={styles.title}>MY WEALTH</ShimmerText>
            <View style={styles.rankPill}><View style={styles.rankDot} /><Text style={styles.rankText}>{level.name.toUpperCase()} · {DIAMOND_LEVELS.indexOf(level) + 1}/{DIAMOND_LEVELS.length}</Text></View>
          </Animated.View>
          <Animated.View style={[styles.center, sValue]}>
            <Text style={styles.inputLabel}>ENTER YOUR NET WORTH</Text>
            <View style={styles.inputShell}>
              <Text style={styles.currency}>$</Text>
              <TextInput
                value={netWorthInput}
                onChangeText={(value) => setNetWorthInput(value.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="rgba(255,244,208,0.28)"
                selectionColor={C.gold}
                style={styles.netWorthInput}
                maxLength={15}
                multiline={false}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
              />
            </View>
            <Text style={[styles.value, { fontSize: valueFontSize(netWorth) }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
              {`$${netWorth.toLocaleString('en-US')}`}
            </Text>
            <Text style={styles.valueNote}>YOUR CURRENT NET WORTH</Text>
            <Text style={styles.diamondDescription}>{diamondDescription(netWorth, level.name)}</Text>
          </Animated.View>
          <Animated.View style={[styles.center, sCard]}>
            <CertificateCard serial={serial} />
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function diamondDescription(value: number, name: string) {
  if (value >= 1_000_000_000_000) return 'Infinity class. Your net worth has left the known universe.';
  if (value >= 100_000_000_000) return 'A cosmic diamond with its own gravitational field.';
  if (value >= 10_000_000_000) return 'An emerald titan. Subtlety is no longer available.';
  if (value >= 1_000_000_000) return 'Imperial class. This gem requires its own economy.';
  if (value >= 100_000_000) return 'A colossal black diamond. Light itself pays rent.';
  if (value >= 10_000_000) return 'A rare red diamond. The vault is yours.';
  if (value >= 1_000_000) return 'A pink diamond. Exceptional and unmistakable.';
  if (value >= 100_000) return 'A blue diamond. Brilliantly uncommon.';
  if (value >= 10_000) return 'A white diamond. Clean, bright, polished.';
  return `${name}. Every fortune starts with one facet.`;
}

function valueFontSize(value: number) {
  if (value >= 10_000_000_000) return 18;
  if (value >= 100_000_000) return 22;
  return 30;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, safe: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }, stack: { alignItems: 'center' },
  header: { position: 'relative', flexDirection: 'row', alignItems: 'center', gap: 12 }, hairline: { width: 34, height: StyleSheet.hairlineWidth, backgroundColor: C.line }, eyebrow: { color: 'rgba(233,200,119,0.6)', fontFamily: SANS, fontSize: 9, letterSpacing: 3.4 },
  authMini: { position: 'absolute', right: -38, width: 25, height: 25, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.22)', backgroundColor: 'rgba(255,255,255,0.035)', alignItems: 'center', justifyContent: 'center' }, authMiniEnabled: { borderColor: 'rgba(141,255,204,0.45)', backgroundColor: 'rgba(141,255,204,0.08)' }, authMiniBody: { position: 'absolute', bottom: 5, width: 9, height: 8, borderRadius: 2, borderWidth: 1, borderColor: C.gold }, authMiniTop: { position: 'absolute', top: 5, width: 7, height: 7, borderWidth: 1, borderBottomWidth: 0, borderColor: C.gold, borderTopLeftRadius: 5, borderTopRightRadius: 5 }, authMiniEnabledPart: { borderColor: '#8DFFCC' },
  gemWrap: { marginTop: -6, marginBottom: -18 }, center: { alignItems: 'center' }, title: { fontFamily: SERIF, fontSize: 44, letterSpacing: 7, lineHeight: 56, textAlign: 'center' },
  rankPill: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.05)' }, rankDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.gold }, rankText: { color: 'rgba(255,244,208,0.78)', fontFamily: SANS, fontSize: 9, letterSpacing: 1.8 },
  inputLabel: { color: 'rgba(255,244,208,0.42)', fontFamily: SANS, fontSize: 9, letterSpacing: 2.2, marginTop: 12, marginBottom: 7 }, inputShell: { width: 280, height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.055)', overflow: 'hidden' }, currency: { width: 22, color: C.gold, fontFamily: SERIF, fontSize: 23 }, netWorthInput: { flex: 1, minWidth: 0, height: 50, paddingHorizontal: 4, paddingVertical: 0, color: C.goldLight, fontFamily: SERIF, fontSize: 24, lineHeight: 30, textAlign: 'right', includeFontPadding: false },
  value: { width: 280, color: C.gold, fontFamily: SERIF, fontSize: 30, letterSpacing: 1, marginTop: 12, textAlign: 'center' }, valueNote: { color: 'rgba(255,244,208,0.34)', fontFamily: SANS, fontSize: 9, letterSpacing: 2.2, marginTop: 4 }, diamondDescription: { width: 250, color: 'rgba(255,244,208,0.54)', fontFamily: SANS, fontSize: 10, lineHeight: 16, letterSpacing: 0.5, textAlign: 'center', marginTop: 12, marginBottom: 14 },
});
