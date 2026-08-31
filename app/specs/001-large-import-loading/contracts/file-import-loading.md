# UI Contract: File Import Loading

## Scope

Applies to personal-finance JSON, ZIP, and CSV imports and Store JSON imports.

## Inputs

- A selected file with URI, name, and optional byte size.
- A user decision when destructive replacement confirmation is required.

## Observable behavior

1. Starting selection marks the import flow busy and disables duplicate import actions.
2. After a file is selected, the UI yields before reading or parsing it.
3. A size of at least 5 MiB, or unknown size, receives the conservative large-file yield.
4. Valid destructive imports transition to confirmation without mutating application state.
5. Confirmed restoration shows loading feedback before restoration work begins.
6. Success, cancellation, and failure all clear loading feedback.
7. Failure preserves existing data and uses the existing localized error surface.

## Non-goals

- Percentage progress
- Streaming or worker-based parsing
- New import/export formats
- New operating-system permissions
- File-size rejection policy
