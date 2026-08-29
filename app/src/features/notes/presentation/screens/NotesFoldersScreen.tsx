import React from 'react';
import { Alert, Animated as NativeAnimated, BackHandler, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFinance } from '@/features/finance/application/FinanceContext';
import { C, SANS, SERIF, createThemeStyles } from '@/shared/theme/luxury';

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const normalizedSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();

function BackButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return <Pressable onPress={onPress} style={styles.backButton} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('finance.back')}><Ionicons name="arrow-back-outline" size={19} color={C.goldLight} /></Pressable>;
}

function Field({ title, value, onChangeText, placeholder, multiline = false }: { title: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean }) {
  const [focused, setFocused] = React.useState(false);
  return <View style={styles.field}><Text style={styles.fieldLabel}>{title}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.textSubtle} multiline={multiline} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} selectionColor={C.gold} style={[styles.input, focused && styles.inputFocused, multiline && styles.multiline]} /></View>;
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type SwipeAction = { icon: IconName; label: string; danger?: boolean; onPress: () => void };
const AnimatedPressable = NativeAnimated.createAnimatedComponent(Pressable);

function SwipeableRow({ children, actions, onPress, accessibilityLabel }: { children: React.ReactNode; actions: SwipeAction[]; onPress?: () => void; accessibilityLabel?: string }) {
  const translateX = React.useRef(new NativeAnimated.Value(0)).current;
  const position = React.useRef(0);
  const gestureStart = React.useRef(0);
  const actionWidth = 74;
  const maxTranslate = actionWidth * actions.length;
  const animateTo = React.useCallback((value: number) => {
    position.current = value;
    NativeAnimated.spring(translateX, { toValue: value, useNativeDriver: true, tension: 90, friction: 12 }).start();
  }, [translateX]);
  const panResponder = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderGrant: () => { gestureStart.current = position.current; translateX.stopAnimation(); },
    onPanResponderMove: (_, gesture) => {
      const next = Math.min(0, Math.max(-maxTranslate, gestureStart.current + gesture.dx));
      position.current = next;
      translateX.setValue(next);
    },
    onPanResponderRelease: (_, gesture) => {
      const next = gestureStart.current + gesture.dx;
      animateTo(next < -maxTranslate / 2 ? -maxTranslate : 0);
    },
    onPanResponderTerminate: () => animateTo(0),
  }), [animateTo, maxTranslate, translateX]);
  const childOnPress = React.isValidElement(children) ? (children.props as { onPress?: () => void }).onPress : undefined;
  return <View style={styles.swipeRow}>
    <View style={styles.swipeActions}>{actions.map((action) => <Pressable key={action.label} style={[styles.swipeAction, action.danger ? styles.swipeDeleteAction : styles.swipeEditAction]} onPress={() => { animateTo(0); action.onPress(); }} accessibilityRole="button" accessibilityLabel={action.label}><Ionicons name={action.icon} size={18} color={action.danger ? C.red : C.gold} /><Text style={[styles.swipeActionText, action.danger && styles.swipeDeleteText]} numberOfLines={1}>{action.label}</Text></Pressable>)}</View>
    <AnimatedPressable pointerEvents="box-only" style={[styles.swipeContent, { transform: [{ translateX }] }]} {...panResponder.panHandlers} onPress={() => { if (position.current < 0) animateTo(0); else (onPress ?? childOnPress)?.(); }} onLongPress={() => animateTo(-maxTranslate)} delayLongPress={450} accessibilityRole={onPress || childOnPress ? 'button' : undefined} accessibilityLabel={accessibilityLabel}>{children}</AnimatedPressable>
  </View>;
}

export default function NotesFoldersScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const finance = useFinance();
  const { state } = finance;
  const [selectedFolderId, setSelectedFolderId] = React.useState<string | null>(null);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [folderOpen, setFolderOpen] = React.useState(false);
  const [folderName, setFolderName] = React.useState('');
  const [editingFolderId, setEditingFolderId] = React.useState<string | null>(null);
  const [folderError, setFolderError] = React.useState('');
  const [note, setNote] = React.useState({ title: '', body: '', folderId: '' });
  const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null);
  const [noteSelection, setNoteSelection] = React.useState({ start: 0, end: 0 });
  const bodyInputRef = React.useRef<TextInput>(null);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (noteOpen) {
        setNoteOpen(false);
        return true;
      }
      if (folderOpen) {
        setFolderOpen(false);
        return true;
      }
      if (selectedFolderId) {
        const currentFolder = state.noteFolders.find((folder) => folder.id === selectedFolderId);
        setSelectedFolderId(currentFolder?.parentFolderId ?? null);
        return true;
      }
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [folderOpen, noteOpen, onBack, selectedFolderId, state.noteFolders]);

  const selectedFolder = React.useMemo(() => selectedFolderId ? state.noteFolders.find((folder) => folder.id === selectedFolderId) : undefined, [selectedFolderId, state.noteFolders]);
  const folderNotes = React.useMemo(() => selectedFolderId
    ? state.notes.filter((item) => item.folderId === selectedFolderId)
    : state.notes.filter((item) => !item.folderId), [selectedFolderId, state.notes]);
  const normalizedQuery = React.useMemo(() => normalizedSearch(query), [query]);
  const visibleFolders = React.useMemo(() => state.noteFolders
    .filter((folder) => (selectedFolderId ? folder.parentFolderId === selectedFolderId : !folder.parentFolderId))
    .filter((folder) => !normalizedQuery || normalizedSearch(folder.name).includes(normalizedQuery))
    .sort((a, b) => a.name.localeCompare(b.name)), [normalizedQuery, selectedFolderId, state.noteFolders]);
  const visibleNotes = React.useMemo(() => folderNotes
    .filter((item) => !normalizedQuery || normalizedSearch(`${item.title} ${item.body}`).includes(normalizedQuery))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [folderNotes, normalizedQuery]);
  const openNewNote = () => {
    setEditingNoteId(null);
    setNote({ title: '', body: '', folderId: selectedFolderId ?? '' });
    setNoteSelection({ start: 0, end: 0 });
    setNoteOpen(true);
  };
  const openNote = (item: typeof state.notes[number]) => {
    setEditingNoteId(item.id);
    setNote({ title: item.title, body: item.body, folderId: item.folderId ?? '' });
    setNoteSelection({ start: item.body.length, end: item.body.length });
    setNoteOpen(true);
  };

  const insertListPrefix = (prefix: string) => {
    const { body } = note;
    const start = Math.max(0, Math.min(noteSelection.start, body.length));
    const end = Math.max(start, Math.min(noteSelection.end, body.length));
    const lineStart = body.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const currentLineBeforeCursor = body.slice(lineStart, start);
    const insertion = currentLineBeforeCursor.trim() ? `\n${prefix}` : prefix;
    const nextBody = `${body.slice(0, start)}${insertion}${body.slice(end)}`;
    const nextCursor = start + insertion.length;
    setNote((current) => ({ ...current, body: nextBody }));
    setNoteSelection({ start: nextCursor, end: nextCursor });
    requestAnimationFrame(() => bodyInputRef.current?.focus());
  };

  const saveNote = () => {
    if (!note.title.trim() && !note.body.trim()) return;
    const now = new Date().toISOString();
    const existing = editingNoteId ? state.notes.find((item) => item.id === editingNoteId) : undefined;
    const value = { title: note.title.trim() || t('finance.untitled'), body: note.body.trim(), tags: existing?.tags ?? [], folderId: note.folderId || undefined, updatedAt: now };
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
    const existing = state.noteFolders.find((folder) => folder.id === editingFolderId);
    const parentFolderId = existing?.parentFolderId ?? (selectedFolderId ?? undefined);
    if (state.noteFolders.some((folder) => folder.id !== editingFolderId && folder.parentFolderId === parentFolderId && folder.name.toLowerCase() === name.toLowerCase())) {
      setFolderError(t('finance.folderExists'));
      return;
    }
    const now = new Date().toISOString();
    const id = existing?.id ?? uid('note-folder');
    if (existing) finance.updateNoteFolder({ ...existing, name, updatedAt: now });
    else finance.addNoteFolder({ id, name, parentFolderId, createdAt: now, updatedAt: now });
    setFolderOpen(false);
    setFolderName('');
    setEditingFolderId(null);
    setFolderError('');
    setSelectedFolderId(null);
  };

  const openFolderEditor = (folder: typeof state.noteFolders[number]) => {
    setEditingFolderId(folder.id);
    setFolderName(folder.name);
    setFolderError('');
    setFolderOpen(true);
  };

  const deleteFolder = (folder: typeof state.noteFolders[number]) => {
    Alert.alert(t('finance.deleteFolder'), t('finance.modules.cannotUndo'), [
      { text: t('finance.cancel'), style: 'cancel' },
      { text: t('finance.deleteAction'), style: 'destructive', onPress: () => { finance.deleteNoteFolder(folder.id); if (selectedFolderId === folder.id) setSelectedFolderId(null); } },
    ]);
  };

  const deleteNote = (item: typeof state.notes[number]) => {
    Alert.alert(t('finance.deleteNote'), t('finance.modules.cannotUndo'), [
      { text: t('finance.cancel'), style: 'cancel' },
      { text: t('finance.deleteAction'), style: 'destructive', onPress: () => finance.updateState((current) => ({ ...current, notes: current.notes.filter((noteItem) => noteItem.id !== item.id) })) },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton onPress={selectedFolderId ? () => { const parentFolderId = selectedFolder?.parentFolderId; setSelectedFolderId(parentFolderId ?? null); setQuery(''); } : onBack} />
        <Text style={styles.headerTitle} numberOfLines={1}>{selectedFolder?.name ?? t('finance.notes')}</Text>
        <View style={styles.headerCompose} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, !visibleNotes.length && !visibleFolders.length && styles.contentEmpty]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.search}><Ionicons name="search-outline" size={17} color={C.textSubtle} /><TextInput value={query} onChangeText={setQuery} placeholder={t('finance.notesSearch', { defaultValue: 'Search notes' })} placeholderTextColor={C.textSubtle} style={styles.searchInput} /><Text style={styles.searchCount}>{visibleNotes.length + visibleFolders.length}</Text></View>
        <View style={[styles.panel, !visibleNotes.length && !visibleFolders.length && styles.panelEmpty]}>
          {visibleFolders.length > 0 ? <>
            {visibleFolders.map((folder) => <SwipeableRow key={folder.id} onPress={() => { setSelectedFolderId(folder.id); setQuery(''); }} accessibilityLabel={folder.name} actions={[{ icon: 'create-outline', label: t('finance.renameFolder'), onPress: () => openFolderEditor(folder) }, { icon: 'trash-outline', label: t('finance.deleteAction'), danger: true, onPress: () => deleteFolder(folder) }]}><View style={styles.folderCard}><View style={styles.folderMain}><View style={styles.folderIcon}><Ionicons name="folder-outline" size={21} color={C.gold} /></View><View style={styles.folderCardMain}><Text style={styles.cardTitle} numberOfLines={1}>{folder.name}</Text><Text style={styles.cardMeta}>{t('finance.noteCount', { count: state.notes.filter((note) => note.folderId === folder.id).length })}</Text></View><Ionicons name="chevron-forward-outline" size={17} color={C.textSubtle} /></View></View></SwipeableRow>)}
          </> : null}
          {visibleNotes.map((item) => <SwipeableRow key={item.id} actions={[{ icon: 'create-outline', label: t('finance.editAction', { defaultValue: 'Editar' }), onPress: () => openNote(item) }, { icon: 'trash-outline', label: t('finance.deleteAction'), danger: true, onPress: () => deleteNote(item) }]}><Pressable style={styles.noteCard} onPress={() => openNote(item)} accessibilityRole="button"><View style={styles.noteMain}><View style={styles.noteHeaderMain}><Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.notePreview} numberOfLines={2}>{new Date(item.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {item.body || t('finance.noActivityCopy')}</Text></View></View><Ionicons name="chevron-forward-outline" size={17} color={C.textSubtle} /></Pressable></SwipeableRow>)}
          {!visibleNotes.length && !visibleFolders.length ? <View style={styles.empty}><View style={styles.diamond} /><Text style={styles.emptyTitle}>{t('finance.noNotes')}</Text><Text style={styles.emptyBody}>{t('finance.noActivityCopy')}</Text></View> : null}
        </View>
      </ScrollView>
      <View style={styles.bottomToolbar}><Pressable style={styles.toolbarAction} onPress={() => { setEditingFolderId(null); setFolderName(''); setFolderError(''); setFolderOpen(true); }}><Ionicons name="folder-open-outline" size={19} color={C.gold} /><Text style={styles.toolbarText}>{t('finance.newFolder')}</Text></Pressable><Pressable style={styles.composeButton} onPress={openNewNote}><Ionicons name="create-outline" size={22} color={C.void} /></Pressable></View>

      <Modal visible={folderOpen} transparent animationType="fade" onRequestClose={() => setFolderOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior="padding" enabled={Platform.OS === 'ios'}>
          <View style={styles.sheet}><Text style={styles.sheetTitle}>{editingFolderId ? t('finance.renameFolder') : t('finance.newFolder')}</Text><Field title={t('finance.folderName')} value={folderName} onChangeText={(value) => { setFolderName(value); setFolderError(''); }} placeholder={t('finance.folderNamePlaceholder')} />{Boolean(folderError) && <Text style={styles.error}>{folderError}</Text>}<Pressable style={[styles.primary, !folderName.trim() && styles.disabled]} disabled={!folderName.trim()} onPress={saveFolder}><Text style={styles.primaryText}>{t('finance.done')}</Text></Pressable><Pressable style={styles.secondary} onPress={() => { setFolderOpen(false); setEditingFolderId(null); }}><Text style={styles.secondaryText}>{t('finance.cancel')}</Text></Pressable></View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={noteOpen} animationType="fade" onRequestClose={() => setNoteOpen(false)}>
        <SafeAreaView style={styles.editorRoot} edges={['top', 'bottom']}><KeyboardAvoidingView style={styles.editorRoot} behavior="padding" enabled={Platform.OS === 'ios'}>
          <View style={styles.editorHeader}><Pressable style={styles.editorHeaderAction} onPress={() => setNoteOpen(false)}><Text style={styles.editorAction}>{t('finance.cancel')}</Text></Pressable><Text style={styles.editorHeading}>{editingNoteId ? t('finance.notes') : t('finance.newNote')}</Text><Pressable style={styles.editorHeaderAction} disabled={!note.title.trim() && !note.body.trim()} onPress={saveNote}><Text style={[styles.editorAction, !note.title.trim() && !note.body.trim() && styles.editorActionDisabled]}>{t('finance.done')}</Text></Pressable></View>
          <ScrollView style={styles.editorScroll} contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled"><TextInput value={note.title} onChangeText={(value) => setNote((current) => ({ ...current, title: value }))} placeholder={t('finance.noteTitle')} placeholderTextColor={C.textSubtle} style={styles.editorTitle} /><TextInput ref={bodyInputRef} value={note.body} onChangeText={(value) => setNote((current) => ({ ...current, body: value }))} onSelectionChange={(event) => setNoteSelection(event.nativeEvent.selection)} selection={noteSelection} placeholder={t('finance.noteBody')} placeholderTextColor={C.textSubtle} multiline style={styles.editorBody} /></ScrollView>
          <View style={styles.editorToolbar}><Pressable style={styles.editorTool} onPress={() => insertListPrefix('\u2610 ')} accessibilityRole="button" accessibilityLabel={t('finance.noteToolbar.checklist')}><Ionicons name="checkbox-outline" size={21} color={C.gold} /></Pressable><Pressable style={styles.editorTool} onPress={() => insertListPrefix('\u2022 ')} accessibilityRole="button" accessibilityLabel={t('finance.noteToolbar.bulletList')}><Ionicons name="list-outline" size={22} color={C.gold} /></Pressable><Pressable style={styles.editorTool} onPress={() => insertListPrefix('1. ')} accessibilityRole="button" accessibilityLabel={t('finance.noteToolbar.numberedList')}><Ionicons name="reorder-three-outline" size={22} color={C.gold} /></Pressable></View>
        </KeyboardAvoidingView></SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = createThemeStyles((C) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: { height: 78, paddingTop: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  backButton: { width: 44, height: 44, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(233,200,119,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, minWidth: 0, marginHorizontal: 8, textAlign: 'center', color: C.goldLight, fontFamily: SERIF, fontSize: 21 },
  headerCompose: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 24, paddingBottom: 96 }, contentEmpty: { flexGrow: 1 },
  search: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.glass, paddingHorizontal: 14, marginBottom: 20 },
  searchInput: { flex: 1, height: 48, color: C.goldLight, fontFamily: SANS, fontSize: 14, paddingVertical: 0 },
  searchCount: { color: 'rgba(255,244,208,0.42)', fontFamily: SANS, fontSize: 11 },
  panel: { overflow: 'hidden', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.1)', backgroundColor: 'rgba(10,12,20,0.42)', paddingHorizontal: 14 }, panelEmpty: { flex: 1 },
  swipeRow: { position: 'relative', overflow: 'hidden' },
  swipeActions: { position: 'absolute', top: 0, right: 0, bottom: 0, flexDirection: 'row' },
  swipeAction: { width: 74, alignItems: 'center', justifyContent: 'center', gap: 4 },
  swipeEditAction: { backgroundColor: 'rgba(233,200,119,0.12)' },
  swipeDeleteAction: { backgroundColor: 'rgba(240,139,136,0.13)' },
  swipeActionText: { color: C.gold, fontFamily: SANS, fontSize: 8, fontWeight: '700' },
  swipeDeleteText: { color: C.red },
  swipeContent: { backgroundColor: C.background },
  sectionHeader: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { color: 'rgba(233,200,119,0.7)', fontFamily: SANS, fontSize: 11, letterSpacing: 1, marginBottom: 6 },
  ghostAction: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  folderCard: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.1)' },
  folderMain: { flex: 1, minWidth: 0, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 11 },
  folderIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  folderCardMain: { flex: 1, minWidth: 0 },
  notesHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.1)' },
  noteCard: { minHeight: 70, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.1)', paddingVertical: 8, flexDirection: 'row', alignItems: 'center' },
  noteMain: { flex: 1, minWidth: 0, minHeight: 54, justifyContent: 'center' },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  noteHeaderMain: { flex: 1, minWidth: 0 },
  noteTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { flexShrink: 1, color: C.goldLight, fontFamily: SANS, fontSize: 13, fontWeight: '600' },
  cardMeta: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 11, marginTop: 4 },
  notePreview: { color: 'rgba(255,244,208,0.54)', fontFamily: SANS, fontSize: 12, lineHeight: 18, marginTop: 6 },
  tagLine: { color: 'rgba(233,200,119,0.58)', fontFamily: SANS, fontSize: 10.5, marginTop: 8 },
  empty: { flexGrow: 1, minHeight: 250, alignItems: 'center', justifyContent: 'center', paddingVertical: 28 },
  diamond: { width: 22, height: 22, borderWidth: 1, borderColor: C.gold, transform: [{ rotate: '45deg' }], marginBottom: 15 },
  emptyTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 12 },
  emptyBody: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 11, lineHeight: 17, marginTop: 7, textAlign: 'center' },
  primary: { minHeight: 46, borderRadius: 14, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  primaryText: { color: C.void, fontFamily: SANS, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  disabled: { opacity: 0.38 },
  secondary: { minHeight: 44, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.gold, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryText: { color: C.gold, fontFamily: SANS, fontSize: 10, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: { width: '100%', maxWidth: 620, maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.11)', backgroundColor: '#0A0C14', paddingHorizontal: 18, paddingTop: 20, paddingBottom: 16 },
  sheetTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 21, marginBottom: 6 },
  field: { marginTop: 8 },
  input: { minHeight: 43, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,200,119,0.16)', backgroundColor: 'transparent', color: C.goldLight, fontFamily: SANS, fontSize: 13.5, paddingHorizontal: 2, paddingVertical: 8 },
  inputFocused: { borderBottomColor: C.gold },
  multiline: { minHeight: 82, textAlignVertical: 'top', paddingTop: 10 },
  error: { color: '#F08B88', fontFamily: SANS, fontSize: 10, marginTop: 8 },
  choices: { gap: 6, paddingVertical: 7 },
  choice: { minHeight: 40, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.025)', paddingHorizontal: 11, justifyContent: 'center' },
  choiceActive: { backgroundColor: 'rgba(233,200,119,0.14)' },
  choiceText: { color: 'rgba(255,244,208,0.58)', fontFamily: SANS, fontSize: 11 },
  choiceTextActive: { color: C.goldLight },
  bottomToolbar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, backgroundColor: 'rgba(9,11,18,0.96)' },
  toolbarAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6 },
  toolbarText: { color: C.gold, fontFamily: SANS, fontSize: 10 },
  composeButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  editorRoot: { flex: 1, backgroundColor: C.background },
  editorHeader: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  editorHeaderAction: { minWidth: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  editorAction: { minWidth: 54, color: C.gold, fontFamily: SANS, fontSize: 11 },
  editorActionDisabled: { opacity: 0.35 },
  editorHeading: { color: 'rgba(255,244,208,0.5)', fontFamily: SANS, fontSize: 10, letterSpacing: 0.8 },
  editorScroll: { flex: 1 },
  editorContent: { width: '100%', maxWidth: 760, alignSelf: 'center', flexGrow: 1, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 50 },
  editorTitle: { color: C.goldLight, fontFamily: SERIF, fontSize: 27, paddingVertical: 8 },
  editorBody: { minHeight: 260, color: 'rgba(255,244,208,0.78)', fontFamily: SANS, fontSize: 15, lineHeight: 23, paddingVertical: 12, textAlignVertical: 'top' },
  editorToolbar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, backgroundColor: 'rgba(9,11,18,0.96)' },
  editorTool: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(233,200,119,0.08)' },
}));
