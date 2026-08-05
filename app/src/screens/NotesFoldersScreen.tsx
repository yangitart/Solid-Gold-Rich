import React from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFinance } from '../core/finance/FinanceContext';
import { C, SANS, SERIF } from '../theme/luxury';

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function BackButton({ onPress }: { onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.backButton} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="arrow-back-outline" size={19} color={C.goldLight} /></Pressable>;
}

function Field({ title, value, onChangeText, placeholder, multiline = false }: { title: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{title}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="rgba(255,244,208,0.3)" multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>;
}

export default function NotesFoldersScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const finance = useFinance();
  const { state } = finance;
  const [selectedFolderId, setSelectedFolderId] = React.useState<string | null>(null);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [folderOpen, setFolderOpen] = React.useState(false);
  const [folderName, setFolderName] = React.useState('');
  const [folderError, setFolderError] = React.useState('');
  const [note, setNote] = React.useState({ title: '', body: '', tags: '', folderId: '' });

  const selectedFolder = selectedFolderId ? state.noteFolders.find((folder) => folder.id === selectedFolderId) : undefined;
  const visibleNotes = selectedFolderId
    ? state.notes.filter((item) => item.folderId === selectedFolderId)
    : state.notes.filter((item) => !item.folderId);

  const openNewNote = () => {
    setNote({ title: '', body: '', tags: '', folderId: selectedFolderId ?? '' });
    setNoteOpen(true);
  };

  const saveNote = () => {
    if (!note.title.trim() && !note.body.trim()) return;
    const now = new Date().toISOString();
    finance.addNote({
      id: uid('note'),
      title: note.title.trim() || t('finance.untitled'),
      body: note.body.trim(),
      tags: note.tags.split(',').map((item) => item.trim()).filter(Boolean),
      folderId: note.folderId || undefined,
      createdAt: now,
      updatedAt: now,
      pinned: false,
    });
    setNoteOpen(false);
  };

  const saveFolder = () => {
    const name = folderName.trim();
    if (!name) {
      setFolderError(t('finance.folderName'));
      return;
    }
    if (state.noteFolders.some((folder) => folder.name.toLowerCase() === name.toLowerCase())) {
      setFolderError(t('finance.folderExists'));
      return;
    }
    const now = new Date().toISOString();
    const id = uid('note-folder');
    finance.addNoteFolder({ id, name, createdAt: now, updatedAt: now });
    setFolderOpen(false);
    setFolderName('');
    setFolderError('');
    setSelectedFolderId(id);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}><BackButton onPress={onBack} /><Text style={styles.headerTitle}>{t('finance.notes')}</Text><View style={styles.headerSpace} /></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.panel}>
          {selectedFolder ? (
            <View style={styles.folderHeader}>
              <BackButton onPress={() => setSelectedFolderId(null)} />
              <View style={styles.folderHeaderMain}><Text style={styles.folderTitle}>{selectedFolder.name}</Text><Text style={styles.cardMeta}>{t('finance.noteCount', { count: visibleNotes.length })}</Text></View>
            </View>
          ) : (
            <>
              <View style={styles.sectionHeader}><Text style={styles.fieldLabel}>{t('finance.folders')}</Text><Pressable onPress={() => { setFolderName(''); setFolderError(''); setFolderOpen(true); }} style={styles.iconButton} accessibilityLabel={t('finance.newFolder')}><Ionicons name="folder-open-outline" size={19} color={C.gold} /></Pressable></View>
              {state.noteFolders.map((folder) => {
                const count = state.notes.filter((item) => item.folderId === folder.id).length;
                return <Pressable key={folder.id} style={styles.folderCard} onPress={() => setSelectedFolderId(folder.id)}><View style={styles.folderIcon}><Ionicons name="folder-outline" size={21} color={C.gold} /></View><View style={styles.folderCardMain}><Text style={styles.cardTitle}>{folder.name}</Text><Text style={styles.cardMeta}>{t('finance.noteCount', { count })}</Text></View><Ionicons name="chevron-forward-outline" size={18} color="rgba(255,244,208,0.35)" /></Pressable>;
              })}
              {!state.noteFolders.length && <Text style={styles.cardMeta}>{t('finance.noFolders')}</Text>}
            </>
          )}

          <Text style={styles.fieldLabel}>{selectedFolder ? t('finance.notes') : t('finance.uncategorized')}</Text>
          {visibleNotes.map((item) => <Pressable key={item.id} style={styles.noteCard} onPress={() => finance.updateNote({ ...item, pinned: !item.pinned, updatedAt: new Date().toISOString() })}><View style={styles.noteHeader}><View style={styles.noteIcon}><Ionicons name="document-text-outline" size={18} color={C.gold} /></View><View style={styles.noteHeaderMain}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.cardMeta}>{item.pinned ? 'PINNED' : 'PIN'}</Text></View><Ionicons name={item.pinned ? 'pin' : 'pin-outline'} size={17} color={item.pinned ? C.gold : 'rgba(255,244,208,0.3)'} /></View><Text style={styles.body}>{item.body}</Text>{Boolean(item.tags.length) && <Text style={styles.cardMeta}>{item.tags.join(' / ')}</Text>}</Pressable>)}
          {!visibleNotes.length && <View style={styles.empty}><View style={styles.diamond} /><Text style={styles.emptyTitle}>{t('finance.noNotes')}</Text><Text style={styles.emptyBody}>{t('finance.noActivityCopy')}</Text></View>}

          <View style={styles.actions}>
            {!selectedFolder && <Pressable style={[styles.secondary, styles.action]} onPress={() => { setFolderName(''); setFolderError(''); setFolderOpen(true); }}><Text style={styles.secondaryText}>{t('finance.newFolder')}</Text></Pressable>}
            <Pressable style={[styles.primary, styles.action]} onPress={openNewNote}><Text style={styles.primaryText}>{t('finance.newNote')}</Text></Pressable>
          </View>
        </View>
      </ScrollView>

      <Modal visible={folderOpen} transparent animationType="slide" onRequestClose={() => setFolderOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop}>
          <View style={styles.sheet}><Text style={styles.sheetTitle}>{t('finance.newFolder')}</Text><Field title={t('finance.folderName')} value={folderName} onChangeText={(value) => { setFolderName(value); setFolderError(''); }} placeholder={t('finance.folderNamePlaceholder')} />{Boolean(folderError) && <Text style={styles.error}>{folderError}</Text>}<Pressable style={styles.primary} onPress={saveFolder}><Text style={styles.primaryText}>{t('finance.done')}</Text></Pressable><Pressable style={styles.secondary} onPress={() => setFolderOpen(false)}><Text style={styles.secondaryText}>{t('finance.cancel')}</Text></Pressable></View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={noteOpen} transparent animationType="slide" onRequestClose={() => setNoteOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop}>
          <View style={styles.sheet}><Text style={styles.sheetTitle}>{t('finance.newNote')}</Text><Field title={t('finance.noteTitle')} value={note.title} onChangeText={(value) => setNote((current) => ({ ...current, title: value }))} /><Field title={t('finance.noteBody')} value={note.body} onChangeText={(value) => setNote((current) => ({ ...current, body: value }))} multiline /><Field title={t('finance.tags')} value={note.tags} onChangeText={(value) => setNote((current) => ({ ...current, tags: value }))} placeholder="work, idea" />{state.noteFolders.length > 0 && <><Text style={styles.fieldLabel}>{t('finance.chooseFolder')}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices}><Pressable style={[styles.choice, !note.folderId && styles.choiceActive]} onPress={() => setNote((current) => ({ ...current, folderId: '' }))}><Text style={[styles.choiceText, !note.folderId && styles.choiceTextActive]}>{t('finance.uncategorized')}</Text></Pressable>{state.noteFolders.map((folder) => <Pressable key={folder.id} style={[styles.choice, note.folderId === folder.id && styles.choiceActive]} onPress={() => setNote((current) => ({ ...current, folderId: folder.id }))}><Text style={[styles.choiceText, note.folderId === folder.id && styles.choiceTextActive]}>{folder.name}</Text></Pressable>)}</ScrollView></>}<Pressable style={styles.primary} onPress={saveNote}><Text style={styles.primaryText}>{t('finance.done')}</Text></Pressable><Pressable style={styles.secondary} onPress={() => setNoteOpen(false)}><Text style={styles.secondaryText}>{t('finance.cancel')}</Text></Pressable></View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  header: { height: 78, paddingTop: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  backButton: { width: 42, height: 42, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: C.goldLight, fontFamily: SERIF, fontSize: 21 },
  headerSpace: { width: 42 },
  content: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 50 },
  panel: { borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(10,12,20,0.72)', padding: 14 },
  sectionHeader: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { color: 'rgba(233,200,119,0.62)', fontFamily: SANS, fontSize: 9, letterSpacing: 1, marginBottom: 6 },
  iconButton: { width: 36, height: 36, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  folderCard: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(233,200,119,0.1)' },
  folderIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center' },
  folderCardMain: { flex: 1, minWidth: 0 },
  folderHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 16 },
  folderHeaderMain: { flex: 1, minWidth: 0 },
  folderTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 21 },
  noteCard: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(233,200,119,0.1)', paddingVertical: 13 },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  noteIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center' },
  noteHeaderMain: { flex: 1, minWidth: 0 },
  cardTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 12 },
  cardMeta: { color: 'rgba(255,244,208,0.4)', fontFamily: SANS, fontSize: 9, marginTop: 4 },
  body: { color: 'rgba(255,244,208,0.66)', fontFamily: SANS, fontSize: 11, lineHeight: 18, marginVertical: 10 },
  empty: { alignItems: 'center', paddingVertical: 28 },
  diamond: { width: 22, height: 22, borderWidth: 1, borderColor: C.gold, transform: [{ rotate: '45deg' }], marginBottom: 15 },
  emptyTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 12 },
  emptyBody: { color: 'rgba(255,244,208,0.38)', fontFamily: SANS, fontSize: 9, marginTop: 7, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 9, marginTop: 12 },
  action: { flex: 1, marginTop: 0 },
  primary: { minHeight: 46, borderRadius: 14, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  primaryText: { color: C.void, fontFamily: SANS, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  secondary: { minHeight: 44, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.gold, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryText: { color: C.gold, fontFamily: SANS, fontSize: 10, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 25, borderTopRightRadius: 25, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: '#0A0C14', padding: 18 },
  sheetTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 23, marginBottom: 12 },
  field: { marginTop: 11 },
  input: { minHeight: 45, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.045)', color: C.goldLight, fontFamily: SANS, fontSize: 12, paddingHorizontal: 12, paddingVertical: 10 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  error: { color: '#F08B88', fontFamily: SANS, fontSize: 10, marginTop: 8 },
  choices: { gap: 7, paddingVertical: 8 },
  choice: { minHeight: 34, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, paddingHorizontal: 12, justifyContent: 'center' },
  choiceActive: { backgroundColor: 'rgba(233,200,119,0.14)', borderColor: C.gold },
  choiceText: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 9 },
  choiceTextActive: { color: C.goldLight },
});
