# Research: Loading Feedback for Large Imports

## Decision 1: Use picker-reported size as optional metadata

**Decision**: Propagate the document picker's optional byte size through `FileAsset`.

**Rationale**: Android providers may omit size. Keeping it optional represents the platform contract
accurately and lets the UI conservatively treat unknown size as potentially large.

**Alternatives considered**:

- Stat the copied cache file afterward: adds another file operation and still cannot help before the
  picker returns.
- Require size: incorrectly rejects valid providers that omit metadata.

## Decision 2: Define large as 5 MiB

**Decision**: Use `5 * 1024 * 1024` bytes as the initial threshold.

**Rationale**: It provides a deterministic boundary for backups large enough to contain substantial
state or embedded pictures while remaining easy to revise from device evidence.

**Alternatives considered**:

- One MiB: would classify routine text exports as large too often.
- Ten MiB: risks delayed feedback on mid-sized JSON backups on slower devices.
- No threshold: loses the ability to treat costly and routine imports differently.

## Decision 3: Yield before synchronous parsing/restoration setup

**Decision**: Activate the existing modal and yield to the render loop before file reading/parsing;
use a slightly longer yield for large or unknown files.

**Rationale**: JSON and archive parsing use the JavaScript thread. Yielding lets React commit the
blocking feedback before that work begins without a new dependency or architecture.

**Alternatives considered**:

- Worker/background parser: larger architectural change not supported directly by the existing Expo
  setup and outside the requested scope.
- Streaming parser: adds dependency and format complexity without current evidence.
- Progress percentage: unavailable without restructuring all parsing operations into measurable
  stages.

## Decision 4: Reuse the existing translated modal

**Decision**: Reuse `importBusy` and existing i18next keys in both screens.

**Rationale**: This preserves the established visual system and all six translations while avoiding
duplicate behavior and strings.

**Alternatives considered**:

- New large-file modal: duplicates UI and translation maintenance.
- Native alert: violates the product visual contract and cannot represent ongoing work reliably.
