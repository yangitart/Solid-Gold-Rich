import type { FinanceState } from '@/features/finance/domain/entities/financeTypes';

export function removeNoteFolder(state: FinanceState, folderId: string): FinanceState {
  const folder = state.noteFolders.find((item) => item.id === folderId);
  if (!folder) return state;
  const parentFolderId = folder.parentFolderId;
  return {
    ...state,
    noteFolders: state.noteFolders
      .filter((item) => item.id !== folderId)
      .map((item) => item.parentFolderId === folderId ? { ...item, parentFolderId } : item),
    notes: state.notes.map((item) => item.folderId === folderId ? { ...item, folderId: parentFolderId } : item),
  };
}
