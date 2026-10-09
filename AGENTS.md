This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npm run lint               # Oxlint (do not use expo lint / ESLint)
npm run format             # Oxfmt (Oxlint is the linter, not the formatter)
npm run typecheck          # TypeScript, including tests
npm run check              # formatting, lint, types, tests and coverage
npm run test:native        # actual Apple sampler PCM + concurrency tests with Thread Sanitizer (macOS)
npm run check:all          # all checks, including native iOS E2E
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

## Mandatory checks after every feature or bug fix

- Add or update meaningful unit/integration tests for changed behavior, and a regression test for every bug fix.
- Keep tests under `tests/`, never inside `src/app/`. Use Jest with `jest-expo` and React Native Testing Library.
- Mock native boundaries only; exercise real store/engine logic. Do not claim JS mocks validate actual audio or Bluetooth.
- Native audio regressions live in `tests/native/` and exercise the production Swift/C++ safety code through SwiftPM.
  `npm run test:native` uses real Apple samplers with offline PCM rendering and Thread Sanitizer. This is a macOS test,
  not verification of iPad speakers, real-time deadlines or AUv3 plugins. Do not add a mutex/allocation to render callbacks.
- Run `npm run format`, then `npm run check:all` after each completed feature or fix. Fix failures and rerun affected checks.
- `npm run check` enforces Oxfmt, Oxlint, TypeScript and unit/integration coverage thresholds. Do not bypass these checks,
  lower coverage thresholds to hide a regression, or leave focused/skipped tests.
- Run and extend `.maestro/flows/` for affected user journeys. The E2E runner requires a current app build on a dedicated
  iOS simulator and clears that simulator's LiveKeys data. Never run reset flows on the user's physical iPad.
- For Swift, audio graph, MIDI/Bluetooth, native dependencies or config changes, also verify a native build and perform
  a real audio/MIDI smoke test; JavaScript tests do not cover these systems.
- If a required runtime, simulator, native build or service is unavailable, finish the checks that can run and explicitly
  report the exact blocked command and prerequisite. Never describe an unexecuted or blocked check as passing.
- Summarize the commands/results and any remaining limitations in the final response.

See `docs/TESTING.md` for commands, coverage scope, native E2E prerequisites and the manual EAS workflow.

## Architecture

Decisions made deliberately. Follow them; change one only on the user's request, and update this section with it.

### Layers

Code is organized by layer in `src/`. The direction of imports is enforced by `no-restricted-imports` in
`.oxlintrc.json`; never disable that rule to make an import pass, move the code to the right layer instead.

- `model/` and `lib/`: data types, rules and pure helpers. No UI, theme, store or engine imports; native module types only.
  Values saved with the concert (e.g. layer colors) belong here, not in `theme.ts`.
- `store/`: Zustand state (persisted concert and settings). No UI or engine imports; native module types only.
- `engine/`: drives the native audio module and follows the store (the store never calls the engine). No UI or theme imports.
- `components/` and `app/`: UI. They reach the native module only through `engine/`: `useEngineEvent` for native events,
  command functions (`engine/notes.ts`, `engine/plugins.ts`, `rescanMidi`…) for calls. Never the module's default export.
  Native views (`PluginEditorView`) and type imports are fine.
- `src/app/` routes stay thin: screen composition and navigation, logic goes to the layers above.

### Deliberately not done

- **No full hexagonal architecture / dependency injection.** `engine/` is the adapter of the native module, and Jest
  replaces that module at its boundary (`tests/mocks/audio-engine.tsx`). Ports, interfaces and DI containers would add
  indirection without benefit for this single-developer app.
- **No reorganization by feature yet.** Layers stay the organization while the app is small (~7k lines). Move to
  `src/features/<name>/` progressively, one feature at a time when it grows, never in a big-bang refactor.
- **No split of the concert store** (`settings` stays in `store/concert.ts`): splitting needs a migration of persisted
  data, a risk not worth it now.
- **No remote crash reporting** (no Sentry available). Screen crashes are logged with `console.error` by `ScreenError`;
  do not add a reporting SDK without the user's decision.

### Robustness rules

- Every route exports `ErrorBoundary` (`export { ScreenError as ErrorBoundary } from '…/components/ScreenError'`),
  so a crash stays inside its screen while the native engine keeps playing. New routes must do the same
  (`tests/integration/screen-errors.test.tsx` fails otherwise).
- Data from outside the app (imported concert files, any future external input) is validated with **valibot**
  (not zod) at the boundary: `model/concertSchema.ts`, used by `lib/concertFile.ts`. Never cast untrusted data with
  `as`. Fields added over time are optional with their default; a file from a newer app version is refused.
- Persistence: when a persisted field changes, bump `version` and extend `migrate` in `store/concert.ts`, and keep
  the import schema in sync. Debounced writes are flushed when the app leaves the foreground (`flushWrites`).
- Native errors in engine calls are caught and surfaced to the user (concert check, alerts); never let a failing
  plugin or MIDI call break a screen or stop the audio.
- Engine start never gives up: a failed audio start is retried (`RETRY_MS` in `engine/boot.ts`, and at once when the
  app comes back to the foreground), and a CoreMIDI failure never fails the audio start: native `start` reports it as
  `midiError`, JS retries with `startMidi`. The concert must load as soon as audio runs, keyboards or not.

### Types and tests

- TypeScript `strict` + `noUncheckedIndexedAccess` on `src/`: handle `undefined` from index or record lookups with
  `??` defaults; use `!` only on constant non-empty tables. Tests use `tests/tsconfig.json` without that flag.
- Coverage is measured on all of `src/`, with a threshold per layer set just under its measured coverage (ratchet).
  New code, UI and screens included, comes with tests that keep its layer above its threshold. Raise a threshold
  when its layer improves, never lower one.
- Accessibility is part of the UI contract: every control has an `accessibilityLabel` (switches, sliders, faders,
  icon buttons), faders are `adjustable` for VoiceOver. Tests find controls by these labels.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
