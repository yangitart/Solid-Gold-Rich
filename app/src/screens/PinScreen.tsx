import React from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { C, SANS, SERIF, createThemeStyles } from '../theme/luxury';
import { hashPin } from '../core/pin';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'submit'] as const;

export default function PinScreen({ pinHash, onUnlock }: { pinHash: string; onUnlock: () => void }) {
  const { t } = useTranslation();
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState(false);

  const pressKey = (key: typeof KEYS[number]) => {
    setError(false);
    if (key === 'back') {
      setPin((current) => current.slice(0, -1));
      return;
    }
    if (key === 'submit') {
      if (hashPin(pin) === pinHash) {
        setPin('');
        onUnlock();
      } else {
        setPin('');
        setError(true);
      }
      return;
    }
    if (pin.length < 4) setPin((current) => `${current}${key}`);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.lockIcon}><Ionicons name="lock-closed-outline" size={28} color={C.gold} /></View>
        <Text style={styles.title}>{t('finance.pin.enter')}</Text>
        <Text style={styles.subtitle}>{t('finance.pin.subtitle')}</Text>
        <View style={styles.dots}>
          {Array.from({ length: 4 }).map((_, index) => <View key={index} style={[styles.dot, index < pin.length && styles.dotFilled]} />)}
        </View>
        {error && <Text style={styles.error}>{t('finance.pin.incorrect')}</Text>}
        <View style={styles.keypad}>
          {KEYS.map((key) => (
            <Pressable key={key} style={styles.key} onPress={() => pressKey(key)} accessibilityRole="button" accessibilityLabel={key === 'back' ? t('finance.pin.backspace') : key === 'submit' ? t('finance.pin.submit') : key}>
              {key === 'back' ? <Ionicons name="backspace-outline" size={22} color={C.goldLight} /> : key === 'submit' ? <Ionicons name="checkmark-outline" size={25} color={C.goldLight} /> : <Text style={styles.keyText}>{key}</Text>}
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = createThemeStyles((C) => StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  lockIcon: { width: 64, height: 64, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  title: { color: C.goldLight, fontFamily: SERIF, fontSize: 26, textAlign: 'center' },
  subtitle: { color: 'rgba(255,244,208,0.42)', fontFamily: SANS, fontSize: 10, letterSpacing: 0.7, marginTop: 8, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(233,200,119,0.45)' },
  dotFilled: { backgroundColor: C.gold, borderColor: C.gold },
  error: { color: C.red, fontFamily: SANS, fontSize: 10, marginBottom: 2 },
  keypad: { width: '100%', maxWidth: 310, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 24 },
  key: { width: 78, height: 58, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.045)', alignItems: 'center', justifyContent: 'center' },
  keyText: { color: C.goldLight, fontFamily: SERIF, fontSize: 23 },
}));
