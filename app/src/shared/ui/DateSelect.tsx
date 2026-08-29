import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, FORM_TYPOGRAPHY, SANS, SERIF, createThemeStyles } from '@/shared/theme/luxury';

function validDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export default function DateSelect({ label, value, onChange, firstDayOfWeek = 1, emptyLabel }: { label: string; value: string; onChange: (value: string) => void; firstDayOfWeek?: 0 | 1; emptyLabel?: string }) {
  const { t, i18n } = useTranslation();
  const selected = validDate(value);
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const language = i18n.resolvedLanguage ?? i18n.language;
  const firstDay = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() - firstDayOfWeek + 7) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = React.useMemo(() => Array.from({ length: 42 }, (_, index) => index - firstDay + 1), [firstDay]);
  const select = (day: number) => {
    const next = new Date(month.getFullYear(), month.getMonth(), day, 12);
    onChange(next.toISOString());
    setOpen(false);
  };
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <Pressable style={styles.select} onPress={() => { setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1)); setOpen(true); }} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name="calendar-outline" size={18} color={C.gold} />
      <Text style={[styles.value, !value && styles.emptyValue]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{value ? selected.toLocaleDateString(language, { year: 'numeric', month: 'long', day: 'numeric' }) : (emptyLabel ?? t('finance.selectDate'))}</Text>
      <Ionicons name="chevron-down-outline" size={17} color="rgba(255,244,208,0.42)" />
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={styles.backdrop} edges={['top', 'bottom']}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Pressable style={styles.iconButton} onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} accessibilityLabel={t('finance.release.previousMonth')}><Ionicons name="chevron-back" size={20} color={C.gold} /></Pressable>
              <Text style={styles.month} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{month.toLocaleDateString(language, { month: 'long', year: 'numeric' })}</Text>
              <Pressable style={styles.iconButton} onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} accessibilityLabel={t('finance.release.nextMonth')}><Ionicons name="chevron-forward" size={20} color={C.gold} /></Pressable>
            </View>
            <View style={styles.week}>{(firstDayOfWeek === 1 ? ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] : ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']).map((day) => <Text key={day} style={styles.weekday}>{t(`finance.weekdays.${day}`)}</Text>)}</View>
            <View style={styles.grid}>{cells.map((day, index) => {
              const active = day > 0 && day <= days;
              const isSelected = active && selected.getFullYear() === month.getFullYear() && selected.getMonth() === month.getMonth() && selected.getDate() === day;
              return <Pressable key={index} disabled={!active} style={[styles.day, isSelected && styles.daySelected]} onPress={() => select(day)}><Text style={[styles.dayText, !active && styles.dayMuted, isSelected && styles.daySelectedText]}>{active ? day : ''}</Text></Pressable>;
            })}</View>
            <Pressable style={styles.cancel} onPress={() => setOpen(false)}><Text style={styles.cancelText}>{t('finance.cancel')}</Text></Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </View>;
}

const styles = createThemeStyles((C) => StyleSheet.create({
  field: { marginTop: 8 }, label: { color: 'rgba(233,200,119,0.54)', fontFamily: SANS, fontSize: FORM_TYPOGRAPHY.label, lineHeight: 14, marginBottom: 1, letterSpacing: 0.25 },
  select: { minHeight: 43, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.16)', backgroundColor: 'transparent', paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', gap: 9 },
  value: { flex: 1, color: C.goldLight, fontFamily: SANS, fontSize: FORM_TYPOGRAPHY.input }, emptyValue: { color: 'rgba(255,244,208,0.35)' }, backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)' }, center: { flexGrow: 1, justifyContent: 'center', padding: 18 },
  sheet: { width: '100%', maxWidth: 430, alignSelf: 'center', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(212,175,55,0.22)', backgroundColor: C.ink, padding: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, month: { color: C.goldLight, fontFamily: SERIF, fontSize: 20, textTransform: 'capitalize' },
  week: { flexDirection: 'row', marginTop: 12 }, weekday: { width: '14.285%', textAlign: 'center', color: 'rgba(255,244,208,0.45)', fontFamily: SANS, fontSize: 10, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 7 }, day: { width: '14.285%', aspectRatio: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, daySelected: { backgroundColor: C.gold }, dayText: { color: C.goldLight, fontFamily: SANS, fontSize: 14 }, dayMuted: { opacity: 0 }, daySelectedText: { color: C.void, fontWeight: '700' },
  cancel: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, cancelText: { color: C.goldLight, fontFamily: SANS, fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase' },
}));
