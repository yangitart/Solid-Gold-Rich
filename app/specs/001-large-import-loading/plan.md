# Implementation Plan: Loading Feedback for Large Imports

**Feature**: `001-large-import-loading` | **Date**: 2026-08-31 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-large-import-loading/spec.md`

## Summary

Ensure personal-finance and Store imports paint the existing blocking import modal before expensive
file reading, parsing, or restoration. Carry the optional selected-file size through the file port,
centralize a 5 MiB threshold and render yield, and apply it consistently to selection and confirmed
restoration without adding permissions, dependencies, or visible strings.

## Technical Context

**Language/Version**: TypeScript 5.9.2, React 19.1, React Native 0.81.5

**Primary Dependencies**: Expo SDK 54, `expo-document-picker`, `expo-file-system`, i18next

**Storage**: Local `AsyncStorage`, Expo cache, and app-private document storage

**Testing**: `tsc --noEmit`, ESLint, Node domain tests, translation parity, manual Android scenarios

**Target Platform**: Native Android; iOS compatibility retained through Expo adapters

**Project Type**: Layered Expo/React Native mobile application

**Performance Goals**: Paint loading feedback before processing imports at or above 5 MiB; clean up
feedback on every terminal path

**Constraints**: Offline-capable, no broad storage permission, no new dependency, APK target below
20 MB, preserve current import/confirmation UI

**Scale/Scope**: Four import stages across two presentation screens, one shared file port, one Expo
adapter, and one shared loading utility

## Constitution Check

*GATE: Passed before research and re-checked after design.*

| Principle | Gate | Evidence |
|-----------|------|----------|
| I. Specification Authority and Traceability | PASS | FR/SC IDs map to user stories, tasks, and quickstart scenarios. |
| II. Layered Architecture and State Integrity | PASS | File metadata remains in the port/adapter; UI timing stays in presentation/shared infrastructure. |
| III. Local-First Privacy and Safe Data Exchange | PASS | The system picker and private cache remain unchanged; no permission or network addition. |
| IV. Consistent, Accessible Product Experience | PASS | Existing translated modal and confirmation components are reused. |
| V. Verification and Evidence | PASS | Automated project checks and Android manual scenarios are defined. |

**Post-design re-check**: PASS. The contract, data model, and tasks introduce no constitutional
exception and preserve validation-before-mutation behavior.

## Phase 0: Research Decisions

Research is recorded in [research.md](./research.md). The selected design propagates the picker size
as optional metadata and yields once to the render loop before costly work. Alternatives involving a
new parsing dependency, worker, or permission were rejected as unnecessary for the requested scope.

## Phase 1: Design and Contracts

- [data-model.md](./data-model.md) defines `FileAsset` metadata and the transient import lifecycle.
- [file-import-loading.md](./contracts/file-import-loading.md) defines observable import behavior.
- [quickstart.md](./quickstart.md) defines runnable validation scenarios.

## Project Structure

### Documentation (this feature)

```text
specs/001-large-import-loading/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- file-import-loading.md
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
src/
|-- shared/
|   |-- application/ports/FileService.ts
|   `-- infrastructure/files/
|       |-- expoFileService.ts
|       `-- importLoading.ts
`-- features/
    |-- finance/presentation/screens/FinanceModulesScreen.tsx
    `-- store/presentation/screens/StoreScreen.tsx
```

**Structure Decision**: Preserve the existing layered mobile structure. The file size belongs to the
shared file-service contract; Expo-specific extraction stays in the adapter; transient loading state
and user interaction remain in the two presentation screens.

## Complexity Tracking

No constitution violations or added architectural complexity require justification.
