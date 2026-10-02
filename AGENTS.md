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
