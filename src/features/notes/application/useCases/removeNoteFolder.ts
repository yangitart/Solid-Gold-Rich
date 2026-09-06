import type { Note, NoteFolder } from '@/features/notes/domain/entities/Note';

export function removeNoteFolder<T extends { notes: Note[]; noteFolders: NoteFolder[] }>(
  state: T,
  folderId: string,
): T {
  const folder = state.noteFolders.find((item) => item.id === folderId);
  if (!folder) return state;
  const parentFolderId = folder.parentFolderId;
  return {
    ...state,
    noteFolders: state.noteFolders
      .filter((item) => item.id !== folderId)
      .map((item) => (item.parentFolderId === folderId ? { ...item, parentFolderId } : item)),
    notes: state.notes.map((item) =>
      item.folderId === folderId ? { ...item, folderId: parentFolderId } : item,
    ),
  };
}
