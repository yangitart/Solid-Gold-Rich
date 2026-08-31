# Tasks: Loading Feedback for Large Imports

**Input**: Design documents from `specs/001-large-import-loading/`

**Prerequisites**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Organization**: Tasks are grouped by user story and trace to requirement IDs. Checked tasks were
implemented and verified while this existing change was migrated into SDD.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Carry file-size metadata and centralize large-import loading preparation.

- [x] T001 [P] Add optional selected-file size to `FileAsset` for FR-002/FR-003 in `src/shared/application/ports/FileService.ts`
- [x] T002 [P] Propagate picker-reported byte size for FR-003 in `src/shared/infrastructure/files/expoFileService.ts`
- [x] T003 Create the 5 MiB threshold and render-yield utility for FR-002/FR-003 in `src/shared/infrastructure/files/importLoading.ts`

**Checkpoint**: Shared file metadata and loading preparation are available to both workspaces.

---

## Phase 2: User Story 1 - See progress while importing (Priority: P1) MVP

**Goal**: Display blocking feedback before costly personal-finance and Store import work.

**Independent Test**: Select a valid personal or Store backup of at least 5 MiB and observe loading
feedback before validation and during confirmed restoration.

- [x] T004 [P] [US1] Apply pre-read loading preparation to personal JSON/ZIP/CSV imports for FR-001/FR-004 in `src/features/finance/presentation/screens/FinanceModulesScreen.tsx`
- [x] T005 [P] [US1] Apply pre-read loading preparation to Store JSON imports for FR-001/FR-004 in `src/features/store/presentation/screens/StoreScreen.tsx`
- [x] T006 [US1] Show loading before confirmed personal and Store restoration for FR-004/FR-007 in `src/features/finance/presentation/screens/FinanceModulesScreen.tsx` and `src/features/store/presentation/screens/StoreScreen.tsx`

**Checkpoint**: User Story 1 is independently functional for both workspaces.

---

## Phase 3: User Story 2 - Recover safely from cancellation or failure (Priority: P2)

**Goal**: Always dismiss loading feedback and preserve data after cancellation or failure.

**Independent Test**: Cancel selection and confirmation, then select an invalid file; each path must
return to the usable screen with existing data unchanged.

- [x] T007 [US2] Preserve terminal cleanup and duplicate-action guards for FR-005/FR-006/FR-010 in `src/features/finance/presentation/screens/FinanceModulesScreen.tsx` and `src/features/store/presentation/screens/StoreScreen.tsx`

**Checkpoint**: User Stories 1 and 2 are independently functional.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Validate quality, localization, and device-visible behavior.

- [x] T008 Run automated checks for FR-008/FR-009 and record successful TypeScript, ESLint, domain, translation, and diff validation in `specs/001-large-import-loading/quickstart.md`
- [ ] T009 Execute all Android device scenarios for SC-001 through SC-005 in `specs/001-large-import-loading/quickstart.md`

---

## Dependencies & Execution Order

- T001 and T002 can begin in parallel, but T003 must exist before presentation integration.
- T004 and T005 depend on T001-T003 and can run in parallel because they affect separate screens.
- T006 follows T004/T005 because it extends the same screen flows.
- T007 follows both user-facing flows and verifies every terminal branch.
- T008 and T009 validate the completed implementation; T009 requires an Android runtime.

## Parallel Opportunities

- T001 and T002 modify different shared files.
- T004 and T005 implement the same contract in different workspace screens.

## Implementation Strategy

1. Complete shared metadata and loading infrastructure.
2. Deliver User Story 1 as the MVP across both workspaces.
3. Validate User Story 2 failure/cancellation behavior.
4. Run automated validation, then execute the Android quickstart before declaring convergence.

## Task Summary

- Total tasks: 9
- User Story 1: 3 tasks
- User Story 2: 1 task
- Setup/cross-cutting: 5 tasks
- Remaining: T009 Android device validation
