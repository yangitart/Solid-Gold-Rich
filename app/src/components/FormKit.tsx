import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, SANS, SERIF, createThemeStyles } from '../theme/luxury';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type SelectOption = { value: string; label: string; icon?: IconName; description?: string };

export function ResponsiveSheet({ visible, title, onClose, children, closeLabel, footer }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode; closeLabel: string; footer?: React.ReactNode }) {
  const tablet = useWindowDimensions().width >= 700;
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <KeyboardAvoidingView style={[styles.backdrop, tablet && styles.tabletBackdrop]} behavior="padding" enabled={Platform.OS === 'ios'}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} />
      <SafeAreaView style={[styles.sheet, tablet && styles.tabletSheet]} edges={['bottom']}>
        <View style={styles.handle} />
        <View style={styles.header}><Text style={styles.title} numberOfLines={2}>{title}</Text><Pressable style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel}><Ionicons name="close" size={20} color={C.goldLight} /></Pressable></View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
    </KeyboardAvoidingView>
  </Modal>;
}

export function FormField({ label, value, onChangeText, placeholder, error, required, numeric, multiline, editable = true }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; error?: string; required?: boolean; numeric?: boolean; multiline?: boolean; editable?: boolean }) {
  const handleChange = (raw: string) => {
    if (!numeric) { onChangeText(raw); return; }
    const cleaned = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const [whole, ...decimals] = cleaned.split('.');
    onChangeText(decimals.length ? `${whole}.${decimals.join('')}` : cleaned);
  };
  return <View style={styles.field}>
    <Text style={styles.label} numberOfLines={2}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text>
    <TextInput
      value={value}
      onChangeText={handleChange}
      placeholder={placeholder}
      placeholderTextColor={C.textSubtle}
      keyboardType={numeric ? 'decimal-pad' : 'default'}
      multiline={multiline}
      editable={editable}
      accessibilityLabel={label}
      style={[styles.input, multiline && styles.multiline, !editable && styles.disabledInput, Boolean(error) && styles.inputError]}
    />
    {error ? <Text style={styles.error} numberOfLines={2}>{error}</Text> : null}
  </View>;
}

export function SegmentedControl({ options, value, onChange, label }: { options: SelectOption[]; value: string; onChange: (value: string) => void; label?: string }) {
  return <View style={styles.field}>{label ? <Text style={styles.label} numberOfLines={2}>{label}</Text> : null}<View style={styles.segments}>{options.map((option) => {
    const selected = value === option.value;
    return <Pressable key={option.value} style={[styles.segment, selected && styles.segmentSelected]} onPress={() => onChange(option.value)} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={option.label}>{option.icon ? <Ionicons name={option.icon} size={17} color={selected ? C.void : C.gold} /> : null}<Text style={[styles.segmentText, selected && styles.segmentTextSelected]} numberOfLines={1}>{option.label}</Text></Pressable>;
  })}</View></View>;
}

export function SearchableSelect({ label, value, options, onChange, placeholder, searchPlaceholder, closeLabel, emptyLabel, required, error, disabled }: { label: string; value: string; options: SelectOption[]; onChange: (value: string) => void; placeholder: string; searchPlaceholder: string; closeLabel: string; emptyLabel: string; required?: boolean; error?: string; disabled?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const selected = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visible = options.filter((option) => !normalizedQuery || `${option.label} ${option.description ?? ''}`.toLocaleLowerCase().includes(normalizedQuery));
  const close = () => { setOpen(false); setQuery(''); };
  return <View style={styles.field}>
    <Text style={styles.label} numberOfLines={2}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text>
    <Pressable style={[styles.select, disabled && styles.disabledInput, Boolean(error) && styles.inputError]} onPress={() => !disabled && setOpen(true)} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}><View style={styles.selectCopy}>{selected?.icon ? <Ionicons name={selected.icon} size={18} color={C.gold} /> : null}<Text style={[styles.selectText, !selected && styles.placeholder]} numberOfLines={1}>{selected?.label ?? placeholder}</Text></View><Ionicons name="chevron-down" size={17} color={C.textSubtle} /></Pressable>
    {error ? <Text style={styles.error} numberOfLines={2}>{error}</Text> : null}
    <ResponsiveSheet visible={open} title={label} onClose={close} closeLabel={closeLabel}>
      <View style={styles.search}><Ionicons name="search-outline" size={18} color={C.textSubtle} /><TextInput value={query} onChangeText={setQuery} placeholder={searchPlaceholder} placeholderTextColor={C.textSubtle} style={styles.searchInput} accessibilityLabel={searchPlaceholder} /></View>
      <View style={styles.options}>{visible.map((option) => {
        const active = value === option.value;
        return <Pressable key={option.value} style={[styles.option, active && styles.optionActive]} onPress={() => { onChange(option.value); close(); }} accessibilityRole="radio" accessibilityState={{ selected: active }}>{option.icon ? <View style={styles.optionIcon}><Ionicons name={option.icon} size={18} color={active ? C.goldLight : C.gold} /></View> : null}<View style={styles.optionCopy}><Text style={styles.optionLabel} numberOfLines={2}>{option.label}</Text>{option.description ? <Text style={styles.optionDescription} numberOfLines={2}>{option.description}</Text> : null}</View><View style={[styles.check, active && styles.checkActive]}>{active ? <Ionicons name="checkmark" size={14} color={C.void} /> : null}</View></Pressable>;
      })}{!visible.length ? <Text style={styles.empty} numberOfLines={3}>{emptyLabel}</Text> : null}</View>
    </ResponsiveSheet>
  </View>;
}

export function FormActions({ cancelLabel, saveLabel, onCancel, onSave, disabled, compact, destructiveLabel, onDestructive }: { cancelLabel?: string; saveLabel: string; onCancel?: () => void; onSave: () => void; disabled?: boolean; compact?: boolean; destructiveLabel?: string; onDestructive?: () => void }) {
  return <View style={styles.actions}>{destructiveLabel && onDestructive ? <Pressable style={styles.destructive} onPress={onDestructive} accessibilityRole="button"><Text style={styles.destructiveText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{destructiveLabel}</Text></Pressable> : null}<View style={styles.actionRow}>{cancelLabel && onCancel ? <Pressable style={styles.cancel} onPress={onCancel} accessibilityRole="button"><Text style={styles.cancelText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{cancelLabel}</Text></Pressable> : null}<Pressable style={[styles.save, compact && styles.saveCompact, !cancelLabel && styles.saveFull, disabled && styles.saveDisabled]} onPress={onSave} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}><Text style={styles.saveText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{saveLabel}</Text></Pressable></View></View>;
}

const styles = createThemeStyles((C) => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.72)' },
  tabletBackdrop: { justifyContent: 'center', padding: 28 },
  sheet: { width: '100%', maxWidth: 620, maxHeight: '94%', backgroundColor: '#0A0C14', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.16)', overflow: 'hidden' },
  tabletSheet: { borderRadius: 24, maxHeight: '84%' },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,244,208,0.24)', alignSelf: 'center', marginTop: 9 },
  header: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.1)' },
  title: { flex: 1, color: C.goldLight, fontFamily: SERIF, fontSize: 20 },
  close: { width: 44, height: 44, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexShrink: 1 },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 },
  footer: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, backgroundColor: '#0A0C14' },
  field: { marginTop: 9 },
  label: { color: 'rgba(233,200,119,0.62)', fontFamily: SANS, fontSize: 10, lineHeight: 15, marginBottom: 4, letterSpacing: 0.35 },
  required: { color: '#F08B88' },
  input: { minHeight: 44, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.14)', backgroundColor: 'rgba(255,255,255,0.025)', color: C.goldLight, fontFamily: SANS, fontSize: 13, paddingHorizontal: 12, paddingVertical: 8 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  disabledInput: { opacity: 0.48 },
  inputError: { borderColor: 'rgba(240,139,136,0.8)' },
  error: { color: '#F08B88', fontFamily: SANS, fontSize: 10, lineHeight: 15, marginTop: 5 },
  segments: { minHeight: 48, flexDirection: 'row', gap: 7 },
  segment: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  segmentSelected: { backgroundColor: C.gold, borderColor: C.gold },
  segmentText: { color: 'rgba(255,244,208,0.62)', fontFamily: SANS, fontSize: 11 },
  segmentTextSelected: { color: C.void, fontWeight: '700' },
  select: { minHeight: 44, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.14)', backgroundColor: 'rgba(255,255,255,0.025)', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  selectCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  selectText: { flex: 1, minWidth: 0, color: C.goldLight, fontFamily: SANS, fontSize: 13 },
  placeholder: { color: 'rgba(255,244,208,0.3)' },
  search: { height: 48, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  searchInput: { flex: 1, minWidth: 0, height: 46, color: C.goldLight, fontFamily: SANS, fontSize: 13 },
  options: { paddingBottom: 10 },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 9, borderRadius: 11, marginBottom: 3 },
  optionActive: { backgroundColor: 'rgba(233,200,119,0.1)' },
  optionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  optionCopy: { flex: 1, minWidth: 0 },
  optionLabel: { color: C.goldLight, fontFamily: SANS, fontSize: 13 },
  optionDescription: { color: 'rgba(255,244,208,0.43)', fontFamily: SANS, fontSize: 10, marginTop: 3 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.28)', alignItems: 'center', justifyContent: 'center' },
  checkActive: { backgroundColor: C.gold, borderColor: C.gold },
  empty: { minHeight: 90, color: 'rgba(255,244,208,0.45)', fontFamily: SANS, fontSize: 11, textAlign: 'center', textAlignVertical: 'center', paddingTop: 34 },
  actions: { gap: 9 },
  actionRow: { flexDirection: 'row', gap: 8 },
  cancel: { flex: 1, minHeight: 48, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: C.gold, fontFamily: SANS, fontSize: 11, fontWeight: '700' },
  save: { flex: 1.35, minHeight: 48, borderRadius: 13, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  saveCompact: { flex: 0, alignSelf: 'flex-end', minHeight: 40, paddingHorizontal: 18, borderRadius: 11 },
  saveFull: { flex: 1 },
  saveDisabled: { opacity: 0.38 },
  saveText: { color: C.void, fontFamily: SANS, fontSize: 11, fontWeight: '800' },
  destructive: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  destructiveText: { color: '#F08B88', fontFamily: SANS, fontSize: 10, fontWeight: '700' },
}));
