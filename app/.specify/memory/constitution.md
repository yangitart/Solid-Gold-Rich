<!--
Sync Impact Report
- Version change: template -> 1.0.0
- Added principles: Spec authority and traceability; Layered architecture and state integrity;
  Local-first privacy and safe data exchange; Consistent accessible product experience;
  Verification and evidence.
- Added sections: Product and technical constraints; SDD workflow and quality gates.
- Removed sections: none; initial ratification replaces template placeholders.
- Follow-up TODOs: none.
-->
# Solid Gold Rich Constitution

## Core Principles

### I. Specification Authority and Traceability

Every material feature or behavior change MUST begin with or update a feature specification under
`specs/`. The specification defines WHAT and WHY through prioritized user stories, testable
requirements (`FR-###`), measurable success criteria (`SC-###`), edge cases, assumptions, and
explicit exclusions. The plan defines HOW; `tasks.md` MUST map executable work to requirements and
user stories with stable task IDs and exact file paths. Code MUST serve the approved artifacts, and
drift MUST be resolved by updating the appropriate artifact before or with implementation.

### II. Layered Architecture and State Integrity

The existing domain/application/infrastructure/presentation boundaries MUST be preserved. Domain
code MUST remain independent of UI and infrastructure; presentation MUST consume use cases and
ports; Expo and storage APIs MUST remain behind adapters. `AppState` and its repository remain the
single source of persisted application state. Store data MUST remain isolated from personal finance
data except through explicit, modeled operations. Existing storage keys, schema migrations, backup
versions, and cross-workspace consistency rules MUST NOT be broken silently.

### III. Local-First Privacy and Safe Data Exchange

User financial and Store data MUST remain local unless a separately specified feature explicitly
authorizes external processing. File imports MUST use system-granted document access and MUST NOT
request broad storage, media, camera, location, or network permissions. Imported content MUST be
validated before mutation, destructive replacement MUST require explicit confirmation, and a failed
or cancelled import MUST preserve the prior state. Secrets, authentication tokens, full financial
credentials, and private session material MUST NOT enter `AppState`, backups, logs, source control,
or public Expo variables.

### IV. Consistent, Accessible Product Experience

The established dark, gold, premium visual language and stable screen composition MUST be
preserved unless a feature specification authorizes a redesign. Long text and amounts MUST not
overflow supported layouts. Costly operations MUST expose a translated loading, success, or failure
state appropriate to their duration and impact. Every new visible string MUST use i18next and be
present in English, Spanish, Portuguese, French, German, and Italian. Native generic confirmation
alerts MUST NOT replace the app's visual confirmation components for destructive actions.

### V. Verification and Evidence

Every implementation MUST be validated in proportion to risk. At minimum, affected work MUST pass
TypeScript, ESLint, domain tests, translation parity, and JSON parsing; dependency changes MUST also
pass Expo Doctor and an Android export. Acceptance scenarios in `spec.md` MUST be represented by
tasks and verified through automated tests when practical or explicit manual quickstart scenarios
when device behavior is involved. A task MUST be marked complete only after its implementation and
required validation succeed.

## Product and Technical Constraints

- The public name is `Solid Gold Rich`; the Android package is `com.escobar.solidgold`.
- The primary production target is native Android through Expo/React Native; web scaffolding and
  dependencies MUST NOT be added without an approved feature specification.
- The app SHOULD remain below the 20 MB APK target; new dependencies require documented rationale
  in the feature plan and validation of bundle impact.
- `src/legacy/future/config.ts` feature flags MUST remain disabled until a dedicated specification,
  privacy review, backend design, and explicit user approval exist.
- Generated `android/` and `dist/` content MUST NOT be manually edited as implementation source.
- Existing unrelated worktree changes MUST be preserved.

## SDD Workflow and Quality Gates

Changes follow this sequence:

1. `$speckit-constitution` establishes or explicitly amends permanent project rules.
2. `$speckit-specify` creates one numbered feature directory and its validated `spec.md`.
3. `$speckit-clarify` is used before planning when material ambiguity remains.
4. `$speckit-plan` creates the technical plan, research decisions, design artifacts, and quickstart.
5. `$speckit-checklist` MAY add reviewer-owned tests of requirements-writing quality.
6. `$speckit-tasks` creates dependency-ordered, story-traceable executable tasks.
7. `$speckit-analyze` SHOULD verify cross-artifact consistency before implementation.
8. `$speckit-implement` executes tasks phase-by-phase and marks only verified work complete.
9. `$speckit-converge` compares implementation to intent and appends remaining work; implement and
   converge repeat until the feature is converged.

The plan MUST include a Constitution Check before research and again after design. Any violation of
a MUST rule is a blocking gate unless this constitution is explicitly amended first. Requirements
quality checklists and implementation tasks have separate checkbox meanings and MUST NOT be mixed.

## Governance

This constitution supersedes ad-hoc process notes when they conflict. Amendments require an explicit
request, rationale, a Sync Impact Report, and a semantic version change: MAJOR for incompatible rule
removal or redefinition, MINOR for new or materially expanded governance, and PATCH for clarification
without changed meaning. Every feature plan and final review MUST verify compliance. Runtime project
orientation remains in `AGENTS.md`; durable governance belongs here, and feature-specific intent
belongs only in its numbered `specs/` directory.

**Version**: 1.0.0 | **Ratified**: 2026-08-31 | **Last Amended**: 2026-08-31
