import type { Note, NoteFolder } from '@/features/notes/domain/entities/Note';

export type TextSelection = { start: number; end: number };

export type TextEdit = {
  body: string;
  selection: TextSelection;
};

export function countNotesByFolderTree(folders: NoteFolder[], notes: Note[]): Map<string, number> {
  const childrenByParent = new Map<string, string[]>();
  const directCount = new Map<string, number>();

  folders.forEach((folder) => {
    if (!folder.parentFolderId) return;
    const children = childrenByParent.get(folder.parentFolderId);
    if (children) children.push(folder.id);
    else childrenByParent.set(folder.parentFolderId, [folder.id]);
  });
  notes.forEach((note) => {
    if (note.folderId) directCount.set(note.folderId, (directCount.get(note.folderId) ?? 0) + 1);
  });

  const counts = new Map<string, number>();
  const countTree = (folderId: string, ancestors: Set<string>): number => {
    const cached = counts.get(folderId);
    if (cached !== undefined) return cached;
    if (ancestors.has(folderId)) return 0;

    const nextAncestors = new Set(ancestors).add(folderId);
    const total =
      (directCount.get(folderId) ?? 0) +
      (childrenByParent.get(folderId) ?? []).reduce(
        (sum, childId) => sum + countTree(childId, nextAncestors),
        0,
      );
    counts.set(folderId, total);
    return total;
  };

  folders.forEach((folder) => countTree(folder.id, new Set()));
  return counts;
}

export function continueListAfterNewline(
  previousBody: string,
  nextBody: string,
  selection: TextSelection,
): TextEdit | undefined {
  const start = Math.max(0, Math.min(selection.start, previousBody.length));
  const end = Math.max(start, Math.min(selection.end, previousBody.length));
  const nativeNewlineBody = `${previousBody.slice(0, start)}\n${previousBody.slice(end)}`;
  if (nextBody !== nativeNewlineBody) return undefined;

  const lineStart = previousBody.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const currentLine = previousBody.slice(lineStart, start);
  const checkbox = currentLine.match(/^(\s*)[\u2610\u2611]\s(.*)$/);
  const bullet = currentLine.match(/^(\s*)\u2022\s(.*)$/);
  const numbered = currentLine.match(/^(\s*)(\d+)\.\s(.*)$/);
  const quote = currentLine.match(/^(\s*)>\s(.*)$/);
  const match = checkbox ?? bullet ?? numbered ?? quote;
  if (!match) return undefined;

  if (!match[match.length - 1].trim()) {
    const body = `${previousBody.slice(0, lineStart)}${previousBody.slice(end)}`;
    return { body, selection: { start: lineStart, end: lineStart } };
  }

  const prefix = checkbox
    ? `${checkbox[1]}\u2610 `
    : bullet
      ? `${bullet[1]}\u2022 `
      : numbered
        ? `${numbered[1]}${Number(numbered[2]) + 1}. `
        : `${quote![1]}> `;
  const body = `${previousBody.slice(0, start)}\n${prefix}${previousBody.slice(end)}`;
  const cursor = start + 1 + prefix.length;
  return { body, selection: { start: cursor, end: cursor } };
}

export function applyPrefixToCurrentLine(
  body: string,
  selection: TextSelection,
  prefix: string,
): TextEdit {
  const start = Math.max(0, Math.min(selection.start, body.length));
  const end = Math.max(start, Math.min(selection.end, body.length));
  const lineStart = body.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndIndex = body.indexOf('\n', start);
  const lineEnd = lineEndIndex < 0 ? body.length : lineEndIndex;
  const line = body.slice(lineStart, lineEnd);
  const match = line.match(/^([ \t]*)([\u2610\u2611]\s|\u2022\s|\d+\.\s|>\s)?/);
  const indentation = match?.[1] ?? '';
  const currentPrefix = match?.[2] ?? '';
  const markerStart = lineStart + indentation.length;
  const markerEnd = markerStart + currentPrefix.length;
  const nextBody = `${body.slice(0, markerStart)}${prefix}${body.slice(markerEnd)}`;
  const delta = prefix.length - currentPrefix.length;
  const adjustPosition = (position: number) => {
    if (position <= markerStart) return position;
    if (position <= markerEnd) return markerStart + prefix.length;
    return position + delta;
  };

  return {
    body: nextBody,
    selection: { start: adjustPosition(start), end: adjustPosition(end) },
  };
}

export function insertDividerAfterCurrentLine(
  body: string,
  selection: TextSelection,
  divider: string,
): TextEdit {
  const start = Math.max(0, Math.min(selection.start, body.length));
  const lineStart = body.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndIndex = body.indexOf('\n', start);
  const lineEnd = lineEndIndex < 0 ? body.length : lineEndIndex;
  const lineHasText = body.slice(lineStart, lineEnd).trim().length > 0;
  const after = body.slice(lineEnd);
  const hasLineBreakAfter = after.startsWith('\n');
  const insertion = lineHasText
    ? `\n${divider}${hasLineBreakAfter ? '' : '\n'}`
    : `${divider}${hasLineBreakAfter ? '' : '\n'}`;
  const insertionStart = lineHasText ? lineEnd : lineStart;
  const nextBody = `${body.slice(0, insertionStart)}${insertion}${body.slice(lineEnd)}`;
  const cursor = insertionStart + insertion.length + (hasLineBreakAfter ? 1 : 0);
  return { body: nextBody, selection: { start: cursor, end: cursor } };
}
