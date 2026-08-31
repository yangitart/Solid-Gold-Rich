# Feature Specification: Loading Feedback for Large Imports

**Feature Directory**: `001-large-import-loading`

**Created**: 2026-08-31

**Status**: Implemented; pending formal convergence

**Input**: User description: "Que ponga un menu de cargando si es muy grande."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See progress while importing (Priority: P1)

As a user importing a backup or transaction file, I see a blocking loading state before costly
processing begins so I know the app accepted the file and has not frozen.

**Why this priority**: Large financial backups can take noticeable time to read and validate. Clear
feedback prevents repeated taps, abandonment, and uncertainty during a data-sensitive operation.

**Independent Test**: Select a valid personal-finance or Store import of at least 5 MiB and confirm
that a translated loading state is visible before processing and remains until validation finishes.

**Acceptance Scenarios**:

1. **Given** a valid import file of at least 5 MiB, **When** the user selects it, **Then** the app
   displays a blocking loading state before reading or validating the content.
2. **Given** a file provider that does not report file size, **When** the user selects a file,
   **Then** the app treats the operation as potentially large and displays the same loading state.
3. **Given** an import that requires replacement confirmation, **When** the user confirms,
   **Then** the loading state appears before restoration starts and remains until it finishes.

---

### User Story 2 - Recover safely from cancellation or failure (Priority: P2)

As a user, I can cancel file selection or encounter an invalid file without leaving the app stuck in
a loading state or changing my existing data.

**Why this priority**: Loading feedback is only trustworthy when all exit paths restore an usable
screen and preserve financial information.

**Independent Test**: Cancel the system picker, then select an invalid JSON, ZIP, or CSV and verify
that each operation returns to the prior screen, hides loading feedback, and preserves existing data.

**Acceptance Scenarios**:

1. **Given** the import flow is open, **When** the user cancels file selection, **Then** the loading
   state closes and no data changes.
2. **Given** an invalid or unreadable file, **When** validation fails, **Then** the loading state
   closes, the existing localized failure message is shown, and no data changes.
3. **Given** a valid file awaiting destructive confirmation, **When** the user cancels confirmation,
   **Then** no restoration occurs and existing data remains unchanged.

### Edge Cases

- The selected provider reports no file size.
- The filename extension and actual content type disagree.
- A valid archive contains product pictures that extend restoration time.
- The user cancels before selection, cancels replacement confirmation, or the read fails midway.
- A small file finishes almost immediately; the loading state must not remain visible afterward.
- Two import actions are attempted while one import is already active.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST expose a blocking loading state for personal-finance and Store file
  imports before file content is read, parsed, validated, or restored.
- **FR-002**: Files of at least 5 MiB MUST receive enough pre-processing time for the loading state
  to become visible before costly work begins.
- **FR-003**: Files with unknown size MUST be handled as potentially large.
- **FR-004**: The loading state MUST remain active for the full read, validation, confirmation-time
  restoration, and error-handling operation that follows selection.
- **FR-005**: The loading state MUST close after success, failure, or cancellation.
- **FR-006**: Cancellation or failure MUST preserve the complete pre-import application state.
- **FR-007**: Destructive imports MUST retain their explicit confirmation step.
- **FR-008**: The loading state MUST use existing translated product language in all six supported
  locales and MUST not introduce an English-only message.
- **FR-009**: The feature MUST NOT request broad file, media, camera, location, or network
  permissions.
- **FR-010**: The import flow MUST prevent a second import action while the current one is active.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every tested file of at least 5 MiB, the loading state is visible before content
  validation begins.
- **SC-002**: In 100% of tested success, cancellation, and invalid-file paths, loading feedback is
  dismissed when the operation ends.
- **SC-003**: In 100% of tested cancellation and failure paths, a before/after comparison shows no
  imported state mutation.
- **SC-004**: Personal-finance JSON/ZIP/CSV and Store JSON flows all satisfy their acceptance
  scenarios without new operating-system permission prompts.
- **SC-005**: All six supported locales resolve the loading title and supporting copy without
  missing translation keys.

## Assumptions

- Five MiB is the initial product definition of a large import and can be amended in this spec when
  device evidence supports a different threshold.
- The existing blocking import modal, confirmation dialog, and localized messages remain the visual
  contract for this feature.
- Import parsing remains local and offline.
- Streaming parsing, background workers, progress percentages, and new file-size rejection limits
  are out of scope for this feature.
