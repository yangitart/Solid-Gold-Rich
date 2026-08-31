# Quickstart Validation: Loading Feedback for Large Imports

## Prerequisites

- Install project dependencies.
- Prepare valid personal JSON, ZIP, and CSV exports plus a Store JSON export.
- Prepare an invalid JSON file.
- Prepare or enlarge one valid backup to at least 5 MiB.
- Use an Android emulator or physical Android device.

## Automated checks

```powershell
npx.cmd tsc --noEmit
npx.cmd eslint src
npm.cmd run test:domain
npm.cmd run check:i18n
npx.cmd expo config --type prebuild --json
```

Expected: every command exits successfully.

### Automated validation record

| Date | Check | Result |
|------|-------|--------|
| 2026-08-31 | TypeScript (`tsc --noEmit`) | PASS |
| 2026-08-31 | ESLint (`eslint src`) | PASS |
| 2026-08-31 | Domain tests | PASS |
| 2026-08-31 | Translation parity (6 locales) | PASS |
| 2026-08-31 | Resolved Android permissions (`android.permissions: []`) | PASS |
| 2026-08-31 | Patch whitespace (`git diff --check`) | PASS |

## Scenario A: Large personal import

1. Open Personal workspace settings and start import.
2. Select the valid file of at least 5 MiB.
3. Observe the loading modal before validation completes.
4. Confirm replacement when prompted.
5. Observe loading feedback during restoration and the success message afterward.

Expected: one import executes, the modal closes, and restored data is available.

## Scenario B: Large Store import

1. Open Store settings and start import.
2. Select the valid Store JSON of at least 5 MiB.
3. Observe loading feedback before validation and again after confirming replacement.

Expected: Store data is restored without changing unrelated personal-finance data.

## Scenario C: Cancellation

1. Record the current account/Store totals.
2. Start import and cancel the system picker.
3. Start again, select a valid file, and cancel replacement confirmation.

Expected: loading feedback closes in both cases and recorded totals are unchanged.

## Scenario D: Invalid file

1. Record the current account/Store totals.
2. Select the invalid JSON file.

Expected: loading feedback closes, the localized invalid-backup message appears, and recorded totals
are unchanged.
