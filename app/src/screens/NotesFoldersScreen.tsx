import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFinance } from '../core/finance/FinanceContext';
import { C, SANS, SERIF } from '../theme/luxury';

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function BackButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return <Pressable onPress={onPress} style={styles.backButton} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('finance.cancel')}><Ionicons name="arrow-back-outline" size={19} color={C.goldLight} /></Pressable>;
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
  const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');

  const selectedFolder = selectedFolderId ? state.noteFolders.find((folder) => folder.id === selectedFolderId) : undefined;
  const folderNotes = selectedFolderId
    ? state.notes.filter((item) => item.folderId === selectedFolderId)
    : state.notes.filter((item) => !item.folderId);
  const visibleNotes = folderNotes
    .filter((item) => !query.trim() || `${item.title} ${item.body} ${item.tags.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));

  const openNewNote = () => {
    setEditingNoteId(null);
    setNote({ title: '', body: '', tags: '', folderId: selectedFolderId ?? '' });
    setNoteOpen(true);
  };
  const openNote = (item: typeof state.notes[number]) => {
    setEditingNoteId(item.id);
    setNote({ title: item.title, body: item.body, tags: item.tags.join(', '), folderId: item.folderId ?? '' });
    setNoteOpen(true);
  };

  const saveNote = () => {
    if (!note.title.trim() && !note.body.trim()) return;
    const now = new Date().toISOString();
    const existing = editingNoteId ? state.notes.find((item) => item.id === editingNoteId) : undefined;
    const value = { title: note.title.trim() || t('finance.untitled'), body: note.body.trim(), tags: note.tags.split(',').map((item) => item.trim()).filter(Boolean), folderId: note.folderId || undefined, updatedAt: now };
    if (existing) finance.updateNote({ ...existing, ...value });
    else finance.addNote({ id: uid('note'), ...value, createdAt: now, pinned: false });
    setNoteOpen(false);
    setEditingNoteId(null);
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
      <View style={styles.header}><BackButton onPress={onBack} /><Text style={styles.headerTitle} numberOfLines={1}>{selectedFolder?.name ?? t('finance.notes')}</Text><Pressable style={styles.headerCompose} onPress={openNewNote} accessibilityLabel={t('finance.newNote')}><Ionicons name="create-outline" size={21} color={C.gold} /></Pressable></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.search}><Ionicons name="search-outline" size={17} color="rgba(255,244,208,0.35)" /><TextInput value={query} onChangeText={setQuery} placeholder={t('finance.notesSearch', { defaultValue: 'Search notes' })} placeholderTextColor="rgba(255,244,208,0.3)" style={styles.searchInput} /><Text style={styles.searchCount}>{visibleNotes.length}</Text></View>
        <View style={styles.panel}>
          {selectedFolder ? (
            <View style={styles.folderHeader}>
              <Pressable onPress={() => setSelectedFolderId(null)} style={styles.folderBack} accessibilityLabel={t('finance.folders')}><Ionicons name="chevron-back-outline" size={18} color={C.gold} /><Text style={styles.folderBackText}>{t('finance.folders')}</Text></Pressable>
              <Text style={styles.cardMeta}>{t('finance.noteCount', { count: folderNotes.length })}</Text>
            </View>
          ) : (
            <>
              <View style={styles.sectionHeader}><Text style={styles.fieldLabel}>{t('finance.folders')}</Text><Pressable onPress={() => { setFolderName(''); setFolderError(''); setFolderOpen(true); }} style={styles.iconButton} accessibilityLabel={t('finance.newFolder')}><Ionicons name="folder-open-outline" size={19} color={C.gold} /></Pressable></View>
              {state.noteFolders.map((folder) => {
                const count = state.notes.filter((item) => item.folderId === folder.id).length;
                return <Pressable key={folder.id} style={styles.folderCard} onPress={() => setSelectedFolderId(folder.id)}><View style={styles.folderIcon}><Ionicons name="folder-outline" size={21} color={C.gold} /></View><View style={styles.folderCardMain}><Text style={styles.cardTitle}>{folder.name}</Text><Text style={styles.cardMeta}>{t('finance.noteCount', { count })}</Text></View><Ionicons name="chevron-forward-outline" size={18} color="rgba(255,244,208,0.35)" /></Pressable>;
              })}
            </>
          )}

          {visibleNotes.map((item) => <Pressable key={item.id} style={styles.noteCard} onPress={() => openNote(item)}><View style={styles.noteHeader}><View style={styles.noteHeaderMain}><View style={styles.noteTitleRow}><Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>{item.pinned && <Ionicons name="pin" size={13} color={C.gold} />}</View><Text style={styles.notePreview} numberOfLines={1}>{new Date(item.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {item.body || t('finance.noActivityCopy')}</Text></View><Ionicons name="chevron-forward-outline" size={16} color="rgba(255,244,208,0.2)" /></View>{Boolean(item.tags.length) && <Text style={styles.tagLine} numberOfLines={1}>{item.tags.map((tag) => `#${tag}`).join('  ')}</Text>}</Pressable>)}
          {!visibleNotes.length && <View style={styles.empty}><View style={styles.diamond} /><Text style={styles.emptyTitle}>{t('finance.noNotes')}</Text><Text style={styles.emptyBody}>{t('finance.noActivityCopy')}</Text></View>}

        </View>
      </ScrollView>
      <View style={styles.bottomToolbar}>{!selectedFolder && <Pressable style={styles.toolbarAction} onPress={() => { setFolderName(''); setFolderError(''); setFolderOpen(true); }}><Ionicons name="folder-open-outline" size={19} color={C.gold} /><Text style={styles.toolbarText}>{t('finance.newFolder')}</Text></Pressable>}<Pressable style={styles.composeButton} onPress={openNewNote}><Ionicons name="create-outline" size={22} color={C.void} /></Pressable></View>

      <Modal visible={folderOpen} transparent animationType="slide" onRequestClose={() => setFolderOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.sheet}><Text style={styles.sheetTitle}>{t('finance.newFolder')}</Text><Field title={t('finance.folderName')} value={folderName} onChangeText={(value) => { setFolderName(value); setFolderError(''); }} placeholder={t('finance.folderNamePlaceholder')} />{Boolean(folderError) && <Text style={styles.error}>{folderError}</Text>}<Pressable style={[styles.primary, !folderName.trim() && styles.disabled]} disabled={!folderName.trim()} onPress={saveFolder}><Text style={styles.primaryText}>{t('finance.done')}</Text></Pressable><Pressable style={styles.secondary} onPress={() => setFolderOpen(false)}><Text style={styles.secondaryText}>{t('finance.cancel')}</Text></Pressable></View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={noteOpen} animationType="slide" onRequestClose={() => setNoteOpen(false)}>
        <SafeAreaView style={styles.editorRoot} edges={['top', 'bottom']}><KeyboardAvoidingView style={styles.editorRoot} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.editorHeader}><Pressable style={styles.editorHeaderAction} onPress={() => setNoteOpen(false)}><Text style={styles.editorAction}>{t('finance.cancel')}</Text></Pressable><Text style={styles.editorHeading}>{editingNoteId ? t('finance.notes') : t('finance.newNote')}</Text><Pressable style={styles.editorHeaderAction} disabled={!note.title.trim() && !note.body.trim()} onPress={saveNote}><Text style={[styles.editorAction, !note.title.trim() && !note.body.trim() && styles.editorActionDisabled]}>{t('finance.done')}</Text></Pressable></View>
          <ScrollView contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled"><TextInput value={note.title} onChangeText={(value) => setNote((current) => ({ ...current, title: value }))} placeholder={t('finance.noteTitle')} placeholderTextColor="rgba(255,244,208,0.25)" style={styles.editorTitle} /><TextInput value={note.body} onChangeText={(value) => setNote((current) => ({ ...current, body: value }))} placeholder={t('finance.noteBody')} placeholderTextColor="rgba(255,244,208,0.22)" multiline autoFocus style={styles.editorBody} /><Field title={t('finance.tags')} value={note.tags} onChangeText={(value) => setNote((current) => ({ ...current, tags: value }))} placeholder={t('finance.tags')} />{state.noteFolders.length > 0 && <><Text style={styles.fieldLabel}>{t('finance.chooseFolder')}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices}>{state.noteFolders.map((folder) => <Pressable key={folder.id} style={[styles.choice, note.folderId === folder.id && styles.choiceActive]} onPress={() => setNote((current) => ({ ...current, folderId: folder.id }))}><Text style={[styles.choiceText, note.folderId === folder.id && styles.choiceTextActive]}>{folder.name}</Text></Pressable>)}</ScrollView></>}</ScrollView>
        </KeyboardAvoidingView></SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  header: { height: 78, paddingTop: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  backButton: { width: 44, height: 44, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, minWidth: 0, marginHorizontal: 8, textAlign: 'center', color: C.goldLight, fontFamily: SERIF, fontSize: 21 },
  headerCompose: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 24, paddingBottom: 96 },
  search: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.12)', backgroundColor: 'rgba(255,255,255,0.045)', paddingHorizontal: 14, marginBottom: 20 },
  searchInput: { flex: 1, height: 48, color: C.goldLight, fontFamily: SANS, fontSize: 14, paddingVertical: 0 },
  searchCount: { color: 'rgba(255,244,208,0.42)', fontFamily: SANS, fontSize: 11 },
  panel: { overflow: 'hidden', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.1)', backgroundColor: 'rgba(10,12,20,0.42)', paddingHorizontal: 14 },
  sectionHeader: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { color: 'rgba(233,200,119,0.7)', fontFamily: SANS, fontSize: 11, letterSpacing: 1, marginBottom: 6 },
  iconButton: { width: 44, height: 44, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(233,200,119,0.04)', alignItems: 'center', justifyContent: 'center' },
  folderCard: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.1)' },
  folderIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  folderCardMain: { flex: 1, minWidth: 0 },
  folderHeader: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  folderBack: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 3 },
  folderBackText: { color: C.gold, fontFamily: SANS, fontSize: 11 },
  noteCard: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.1)', paddingVertical: 12 },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  noteHeaderMain: { flex: 1, minWidth: 0 },
  noteTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { flexShrink: 1, color: C.goldLight, fontFamily: SANS, fontSize: 13, fontWeight: '600' },
  cardMeta: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 11, marginTop: 4 },
  notePreview: { color: 'rgba(255,244,208,0.54)', fontFamily: SANS, fontSize: 12, lineHeight: 18, marginTop: 6 },
  tagLine: { color: 'rgba(233,200,119,0.58)', fontFamily: SANS, fontSize: 10.5, marginTop: 8 },
  empty: { alignItems: 'center', paddingVertical: 28 },
  diamond: { width: 22, height: 22, borderWidth: 1, borderColor: C.gold, transform: [{ rotate: '45deg' }], marginBottom: 15 },
  emptyTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 12 },
  emptyBody: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 11, lineHeight: 17, marginTop: 7, textAlign: 'center' },
  primary: { minHeight: 46, borderRadius: 14, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  primaryText: { color: C.void, fontFamily: SANS, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  disabled: { opacity: 0.38 },
  secondary: { minHeight: 44, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.gold, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryText: { color: C.gold, fontFamily: SANS, fontSize: 10, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: { width: '100%', maxWidth: 620, maxHeight: '90%', borderTopLeftRadius: 25, borderTopRightRadius: 25, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: '#0A0C14', padding: 18 },
  sheetTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 23, marginBottom: 12 },
  field: { marginTop: 11 },
  input: { minHeight: 48, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.045)', color: C.goldLight, fontFamily: SANS, fontSize: 14, paddingHorizontal: 12, paddingVertical: 10 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  error: { color: '#F08B88', fontFamily: SANS, fontSize: 10, marginTop: 8 },
  choices: { gap: 7, paddingVertical: 8 },
  choice: { minHeight: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, paddingHorizontal: 12, justifyContent: 'center' },
  choiceActive: { backgroundColor: 'rgba(233,200,119,0.14)', borderColor: C.gold },
  choiceText: { color: 'rgba(255,244,208,0.58)', fontFamily: SANS, fontSize: 11 },
  choiceTextActive: { color: C.goldLight },
  bottomToolbar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, backgroundColor: 'rgba(9,11,18,0.96)' },
  toolbarAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6 },
  toolbarText: { color: C.gold, fontFamily: SANS, fontSize: 10 },
  composeButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  editorRoot: { flex: 1, backgroundColor: C.void },
  editorHeader: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  editorHeaderAction: { minWidth: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  editorAction: { minWidth: 54, color: C.gold, fontFamily: SANS, fontSize: 11 },
  editorActionDisabled: { opacity: 0.35 },
  editorHeading: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 10, letterSpacing: 0.8 },
  editorContent: { width: '100%', maxWidth: 760, alignSelf: 'center', flexGrow: 1, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 50 },
  editorTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 27, paddingVertical: 8 },
  editorBody: { minHeight: 260, color: 'rgba(255,244,208,0.78)', fontFamily: SANS, fontSize: 15, lineHeight: 23, paddingVertical: 12, textAlignVertical: 'top' },
});
