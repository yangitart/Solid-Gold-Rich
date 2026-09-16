# Solid Gold Rich

Personal finance and small-business management in an Android app built with Expo,
React Native and TypeScript. Data is stored locally on the device.

## Features

- Accounts, budgets, transfers, debts, savings goals and recurring transactions.
- Multiple currencies with historical currency snapshots.
- Store inventory, sales, clients, providers, employees and reports.
- Notes and folders, JSON backups and CSV import/export workflows.
- English, Spanish, Portuguese, French, German and Italian interfaces.

## Run locally

Use Node.js 22 LTS, npm and an Android emulator or device. For native builds,
install Android Studio, the Android SDK and JDK 17. The project uses Expo SDK 54.

```sh
git clone https://github.com/yangitart/Solid-Gold-Rich.git
cd Solid-Gold-Rich
npm ci
npm start
```

For a local native Android build:

```sh
npm run android
```

Run commands from the repository root. Use Android Studio or the Android SDK
tools to start an emulator. Set `ANDROID_HOME` if your SDK is outside its
default location.

No backend or secret environment variables are required for the current app.
Keep local configuration and signing keys out of Git. The iOS configuration is
present, but iOS is not currently a validated release target. There is no web app.

## Quality checks

Run `npm run format` to apply Prettier to source, tests and configuration.
`npm run format:check` verifies formatting without modifying files.

```sh
npm run check
```

This runs TypeScript, ESLint and Vitest (architecture, translations, domain,
storage, application use cases and reports). Use `npm test` for a single run
or `npm run test:watch` during development. Tests mock native storage and
files; they do not replace Android device testing.

Validate the Android JavaScript bundle separately with:

```sh
npx expo export --platform android
```

The native `android/` directory is generated locally and excluded from Git and
EAS uploads. Preserve local native edits before regenerating it.

CI runs source checks and Android export on pushes to `master` and pull requests.
It does not sign binaries or publish releases.

## Architecture

The entry point is `index.js`. Dependencies point inward:

```text
presentation -> application -> domain
infrastructure -> application contracts / domain
ioc -> adapters and contracts (dependency assembly)
```

- `features/*/domain`: entities and business rules, independent of frameworks.
- `features/*/application`: use cases, commands and service contracts.
- `features/*/infrastructure`: persistence and native service implementations.
- `features/*/presentation`: screens, interaction state and React hooks.
- `shared/domain`: business utilities shared across features, including dates.
- `shared/utils`: framework independent helpers such as Base64 and PIN hashing.
- `shared/ui`: reusable interface components and presentation helpers.
- `domain/AppState.ts`: aggregate persisted state. Its format remains compatible.
- `ioc/dependencies.ts`: Inversify assembly, consumed by `AppRoot`.

The app-state provider owns Zustand and adapts application use cases to React.
Import orchestration and recurring-operation generation live in application code.
`npm test -- tests/architecture.test.js` checks literal imports, re-exports, require calls and
dynamic imports, including aliases and local barrels. Domain cannot depend on
application or platform code; application cannot depend on adapters or UI;
presentation cannot reach infrastructure through local imports. Computed imports
are outside the check's scope.

Further refactoring remains: large screens still coordinate some operations and
the provider still manages the persistence lifecycle. Extract tested use cases
incrementally, preserving storage keys, public hooks and backup compatibility.

## Contributing

Create a focused branch and explain the problem, resulting behavior and validation
in your pull request. Discuss large changes in an issue first. Use English
Conventional Commits without scope, for example `fix: prevent duplicate imports`.
Run `npm run check`; validate Android export for runtime changes and test UI
changes on a device in portrait and landscape. Add regression coverage for money,
inventory, imports and persistence; update all six translations for visible text.
Use synthetic fixtures, never real financial records. Keep generated output and
credentials out of Git. Be respectful and keep discussions focused on the work.

## Data and security

Back up your data before testing imports, updates or uninstalling the app.
The PIN is a convenience screen lock: it does **not** encrypt local storage or
exported backups. Do not treat it as protection against access to device files.
Report vulnerabilities privately to yangitart@gmail.com with the affected version
and reproduction steps using synthetic data. Never attach real backups or secrets
to public issues. There is no guaranteed response time or formal support policy
for older versions. Backup validation does not authenticate the sender, and no
independent security audit has been completed. Never put secrets in
`EXPO_PUBLIC_*`: these variables may be embedded in the application bundle.

Fork maintainers must configure their own Expo account/project, Android package
identity and signing credentials before distributing a build. `app.json`
currently identifies the upstream application and EAS project.

## License

[PolyForm Noncommercial 1.0.0](LICENSE). The code may be copied, modified and
distributed for permitted noncommercial purposes. Commercial sale, commercial
integration and monetized derivatives require separate permission from the
copyright holder. Dependencies retain their respective licenses. Before
publishing a distribution, review the licenses and provenance of bundled
dependencies, fonts and artwork; this repository does not yet contain a complete
asset audit.
