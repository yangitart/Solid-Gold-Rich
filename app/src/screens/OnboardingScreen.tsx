import React from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, SANS, SERIF } from '../theme/luxury';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const PAGES: { key: 'accounts' | 'operations' | 'statistics' | 'organize' | 'privacy'; icon: IconName }[] = [
  { key: 'accounts', icon: 'wallet-outline' },
  { key: 'operations', icon: 'receipt-outline' },
  { key: 'statistics', icon: 'analytics-outline' },
  { key: 'organize', icon: 'folder-open-outline' },
  { key: 'privacy', icon: 'shield-checkmark-outline' },
];

export default function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const scrollRef = React.useRef<ScrollView>(null);
  const [page, setPage] = React.useState(0);
  const compact = height < 700;
  const veryCompact = height < 620;
  const lastPage = page === PAGES.length - 1;

  const updatePage = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.max(0, Math.min(PAGES.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))));
  };

  const continueFlow = () => {
    if (lastPage) {
      onComplete();
      return;
    }
    scrollRef.current?.scrollTo({ x: width * (page + 1), animated: true });
    setPage((current) => Math.min(PAGES.length - 1, current + 1));
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <View style={styles.brandMark}><View style={styles.brandDiamond} /></View>
        <Text style={styles.brand}>SOLID GOLD RICH</Text>
        {!lastPage ? <Pressable onPress={onComplete} hitSlop={10}><Text style={styles.skip}>{t('app.onboarding.skip')}</Text></Pressable> : <View style={styles.topSpacer} />}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={updatePage}
        scrollEventThrottle={16}
      >
        {PAGES.map((item, index) => (
          <View key={item.key} style={[styles.page, { width }, compact && styles.pageCompact]}>
            <View style={[styles.visualStage, compact && styles.visualStageCompact, veryCompact && styles.visualStageVeryCompact]}>
              <LinearGradient colors={['rgba(233,200,119,0.17)', 'rgba(233,200,119,0.025)']} style={styles.visualGlow} />
              <View style={styles.orbitOuter} />
              <View style={styles.orbitInner} />
              <View style={[styles.iconShell, veryCompact && styles.iconShellVeryCompact]}><Ionicons name={item.icon} size={veryCompact ? 31 : compact ? 38 : 44} color={C.goldLight} /></View>
              <View style={[styles.visualTag, index === 1 && styles.visualTagRight]}><View style={styles.visualTagDot} /><Text style={styles.visualTagText}>0{index + 1}</Text></View>
            </View>
            <Text style={styles.eyebrow}>{t(`app.onboarding.pages.${item.key}.eyebrow`)}</Text>
            <Text style={[styles.title, compact && styles.titleCompact, veryCompact && styles.titleVeryCompact]}>{t(`app.onboarding.pages.${item.key}.title`)}</Text>
            <Text style={[styles.body, veryCompact && styles.bodyVeryCompact]}>{t(`app.onboarding.pages.${item.key}.body`)}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>{PAGES.map((item, index) => <View key={item.key} style={[styles.dot, index === page && styles.dotActive]} />)}</View>
        <Pressable style={styles.continueButton} onPress={continueFlow} accessibilityRole="button">
          <Text style={styles.continueText}>{lastPage ? t('app.onboarding.start') : t('app.onboarding.next')}</Text>
          <Ionicons name={lastPage ? 'checkmark' : 'arrow-forward'} size={18} color={C.void} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,5,10,0.9)' },
  topBar: { height: 62, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  brandMark: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  brandDiamond: { width: 12, height: 12, borderWidth: 1, borderColor: C.gold, transform: [{ rotate: '45deg' }] },
  brand: { flex: 1, color: C.goldLight, fontFamily: SANS, fontSize: 8.5, fontWeight: '700', letterSpacing: 1.8 },
  skip: { color: C.gold, fontFamily: SANS, fontSize: 10, fontWeight: '600' },
  topSpacer: { width: 40 },
  page: { paddingHorizontal: 27, paddingTop: 20, alignItems: 'center' },
  pageCompact: { paddingTop: 4 },
  visualStage: { width: 236, height: 236, alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
  visualStageCompact: { width: 184, height: 184, marginBottom: 18 },
  visualStageVeryCompact: { width: 138, height: 138, marginBottom: 10 },
  visualGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 118 },
  orbitOuter: { position: 'absolute', width: '86%', height: '86%', borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.18)' },
  orbitInner: { position: 'absolute', width: '60%', height: '60%', borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,244,208,0.12)' },
  iconShell: { width: 92, height: 92, borderRadius: 30, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.34)', backgroundColor: 'rgba(10,12,20,0.76)', alignItems: 'center', justifyContent: 'center', shadowColor: C.gold, shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 9 }, elevation: 8 },
  iconShellVeryCompact: { width: 68, height: 68, borderRadius: 23 },
  visualTag: { position: 'absolute', left: 12, bottom: 45, height: 28, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.88)', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  visualTagRight: { left: undefined, right: 12, top: 45, bottom: undefined },
  visualTagDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.gold },
  visualTagText: { color: C.goldLight, fontFamily: SANS, fontSize: 8, letterSpacing: 1 },
  eyebrow: { color: 'rgba(233,200,119,0.64)', fontFamily: SANS, fontSize: 8, fontWeight: '700', letterSpacing: 2.1, textAlign: 'center' },
  title: { maxWidth: 330, color: C.goldLight, fontFamily: SERIF, fontSize: 34, lineHeight: 40, textAlign: 'center', marginTop: 11 },
  titleCompact: { fontSize: 29, lineHeight: 34 },
  titleVeryCompact: { fontSize: 25, lineHeight: 29, marginTop: 8 },
  body: { maxWidth: 330, color: 'rgba(255,244,208,0.52)', fontFamily: SANS, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 14 },
  bodyVeryCompact: { fontSize: 10.5, lineHeight: 15, marginTop: 8 },
  footer: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8 },
  dots: { height: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 10 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(233,200,119,0.22)' },
  dotActive: { width: 22, backgroundColor: C.gold },
  continueButton: { width: '100%', minHeight: 52, borderRadius: 17, backgroundColor: C.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  continueText: { color: C.void, fontFamily: SANS, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
});
