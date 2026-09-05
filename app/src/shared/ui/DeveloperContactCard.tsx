import React from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import ActionPressable from './ActionPressable';
import { C, SANS, SERIF, createThemeStyles } from '@/shared/theme/luxury';

const contacts = [
  { id: 'email-primary', kind: 'email', value: 'yangitart@gmail.com' },
  { id: 'email-secondary', kind: 'email', value: 'mirelescobarpupo@gmail.com' },
  { id: 'instagram', kind: 'instagram', value: 'yangitart' },
  { id: 'github', kind: 'github', value: 'yangitart' },
] as const;
type Contact = typeof contacts[number];

export default function DeveloperContactCard({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const opening = React.useRef(false);
  const [pending, setPending] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState<Contact | null>(null);
  const open = async (contact: Contact) => {
    if (opening.current) return;
    opening.current = true;
    setPending(contact.id);
    setFailed(null);
    try {
      const url = contact.kind === 'email'
        ? `mailto:${contact.value}?subject=${encodeURIComponent(t('finance.developerContact.subject'))}`
        : contact.kind === 'instagram' ? `https://www.instagram.com/${contact.value}/` : `https://github.com/${contact.value}`;
      // The system opens the mail composer or the associated app/browser.
      // Only the chosen address and subject are passed to the external app.
      await Linking.openURL(url);
    } catch {
      setFailed(contact);
    } finally {
      opening.current = false;
      setPending(null);
    }
  };

  return <View style={[styles.card, embedded && styles.embedded]}>
    <View style={styles.header}>
      <View style={styles.headerIcon}><Ionicons name="chatbubbles-outline" size={23} color={C.gold} /></View>
      <View style={styles.main}><Text style={styles.eyebrow}>{t('finance.developerContact.team')}</Text><Text style={styles.title}>{t('finance.developerContact.title')}</Text></View>
    </View>
    <Text style={styles.copy}>{t('finance.developerContact.copy')}</Text>
    {contacts.map((contact, index) => {
      const email = contact.kind === 'email';
      const label = email ? t('finance.developerContact.email') : contact.kind === 'instagram' ? t('finance.developerContact.instagram') : t('finance.developerContact.github');
      const value = email ? contact.value : `@${contact.value}`;
      return <ActionPressable key={contact.id} style={[styles.row, index === contacts.length - 1 && styles.lastRow]} onPress={() => void open(contact)} disabled={pending !== null} accessibilityRole="link" accessibilityLabel={`${label}: ${value}`} accessibilityHint={t(email ? 'finance.developerContact.emailHint' : contact.kind === 'instagram' ? 'finance.developerContact.instagramHint' : 'finance.developerContact.githubHint')} accessibilityState={{ busy: pending === contact.id, disabled: pending !== null }}>
        <View style={styles.icon}><Ionicons name={email ? 'mail-outline' : contact.kind === 'instagram' ? 'logo-instagram' : 'logo-github'} size={20} color={C.gold} /></View>
        <View style={styles.main}><Text style={styles.label}>{label}</Text><Text style={styles.value} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>{value}</Text></View>
        {pending === contact.id ? <ActivityIndicator size="small" color={C.gold} /> : <Ionicons name="open-outline" size={17} color={C.textSubtle} />}
      </ActionPressable>;
    })}
    {failed && <View style={styles.errorBox} accessibilityLiveRegion="polite"><Text style={styles.error}>{t(failed.kind === 'email' ? 'finance.developerContact.emailError' : failed.kind === 'instagram' ? 'finance.developerContact.instagramError' : 'finance.developerContact.githubError')}</Text><Text selectable style={styles.fallback}>{failed.kind === 'email' ? failed.value : failed.kind === 'instagram' ? `https://www.instagram.com/${failed.value}/` : `https://github.com/${failed.value}`}</Text></View>}
  </View>;
}

const styles = createThemeStyles((C) => StyleSheet.create({
  card: { width: '100%', maxWidth: 720, alignSelf: 'center', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, padding: 16, marginTop: 10, marginBottom: 16 },
  embedded: { borderWidth: 0, backgroundColor: 'transparent', padding: 0, marginTop: 4, marginBottom: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 }, headerIcon: { width: 45, height: 45, borderRadius: 15, backgroundColor: 'rgba(233,200,119,0.1)', alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, minWidth: 0 }, eyebrow: { color: C.gold, fontFamily: SANS, fontSize: 10, letterSpacing: 0.3, marginBottom: 4 }, title: { color: C.goldLight, fontFamily: SERIF, fontSize: 21, lineHeight: 26 },
  copy: { color: C.textSubtle, fontFamily: SANS, fontSize: 12, lineHeight: 18, marginTop: 12, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 72, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, lastRow: { borderBottomWidth: 0, paddingBottom: 4 },
  icon: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' }, label: { color: C.textSubtle, fontFamily: SANS, fontSize: 10, marginBottom: 5 }, value: { color: C.goldLight, fontFamily: SANS, fontSize: 12, lineHeight: 18 },
  errorBox: { borderRadius: 12, backgroundColor: 'rgba(240,139,136,0.08)', padding: 12, marginTop: 14 }, error: { color: C.red, fontFamily: SANS, fontSize: 11, lineHeight: 17 }, fallback: { color: C.goldLight, fontFamily: SANS, fontSize: 12, lineHeight: 18, marginTop: 8 },
}));
