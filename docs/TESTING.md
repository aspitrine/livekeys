# Code stability checks

Use Node.js 24 LTS and `npm ci`. This project uses npm, not Bun.

## Commands

| Command                                          | Purpose                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `npm run check`                                  | Formatting, lint, TypeScript, unit/integration tests and coverage thresholds |
| `npm run check:all`                              | JS checks, native audio tests, then iOS E2E on a simulator                   |
| `npm run test:native`                            | Swift/C++ safety tests, real sampler PCM, Thread Sanitizer (macOS)           |
| `npm run format`                                 | Format supported source/config/doc files with Oxfmt                          |
| `npm run format:check`                           | Check formatting without writing files                                       |
| `npm run lint` / `npm run lint:fix`              | Oxlint checks / safe automatic fixes                                         |
| `npm run typecheck`                              | TypeScript checks, including test files                                      |
| `npm test` / `npm run test:watch`                | All Jest tests / watch mode                                                  |
| `npm run test:unit` / `npm run test:integration` | Run one test project                                                         |
| `npm run test:coverage`                          | Enforce coverage thresholds and generate `coverage/lcov-report/index.html`   |
| `npm run test:e2e`                               | Maestro native UI flows; missing prerequisites fail the command              |

Oxlint handles correctness, TypeScript, React Hooks and Jest rules. Focused or skipped tests fail lint.
The experimental React Compiler `refs` and `set-state-in-effect` rules are disabled: this project does not use
React Compiler and uses manual native gesture bindings. Rules of Hooks and exhaustive dependencies remain enforced.
Oxfmt retains the existing single quotes and 120-column style; it replaces the old Prettier configuration.
`test-renderer` is pinned to 1.2.0 to match React 19.2; update the renderer together with React, not independently.

## Test boundaries

- `tests/unit/`: chord detection/voicing, concert editing and debounced persistence.
- `tests/integration/`: real store + pad/MIDI logic, engine synchronization, and the pad panel rendered with
  React Native Testing Library. Only native audio and SQLite calls are substituted; navigation calls are mocked in Jest.
- `.maestro/flows/`: actual app navigation, stage mode, pad play/stop and panic.
- `tests/native/`: production pad gain/generation rules, real Apple sampler panic and preset recovery,
  and concurrent DSP counter reads. SwiftPM builds the same safety sources included by the iOS pod;
  Thread Sanitizer checks these tests for data races. This does not compile the entire iOS engine.

Coverage thresholds apply to the ten critical JS/TS files explicitly listed in `jest.config.cjs` (80% lines/statements,
75% functions, 65% branches). This is **not whole-app coverage**. Extend that list when adding another critical module.
JS mocks and UI assertions do not verify Swift compilation, actual sound output, DSP glitches, MIDI/Bluetooth connectivity
or third-party Audio Units. Changes to those areas also require a native build and an audio/MIDI smoke test on iPad.

Keep tests outside `src/app/`, where files become Expo Router routes. Write regression tests for bug fixes and behavioral
tests for meaningful new features. Prefer public APIs and user interactions over private implementation checks or snapshots.

## Native iOS E2E

Install [Maestro CLI](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli) and Java 17+.
The runner recognizes Maestro in `PATH`, `~/.maestro/bin/maestro`, or the ignored `.tools/maestro/bin/maestro` directory.
`MAESTRO_BIN` can select another binary. It also recognizes an optional local Java runtime in `.tools/java/Contents/Home`.

Install a **current** simulator build of LiveKeys (`net.eliakim.livekeys`) on a booted iPad simulator.
Use `npx eas-cli@latest build --platform ios --profile e2e` for a standalone simulator build.
The EAS build profile embeds the JS bundle, so Metro is not needed.

```bash
MAESTRO_DEVICE_UDID=SIMULATOR_UDID npm run test:e2e
```

If there is exactly one booted simulator, its UDID is selected automatically. Physical iPads are refused by the runner.
Flows set portrait orientation, clear the simulator's LiveKeys data before each test and leave test data afterward.
Use a dedicated test simulator. Landscape layout still requires a separate manual check.
Reports and screenshots go to `.maestro-results/`.

For an existing development build, bind Metro to IPv4 loopback and provide its dev-client URL.
Node resolves localhost to IPv6 first on this Mac. Force IPv4 ordering so `--localhost` listens on `127.0.0.1`,
without exposing source code on the LAN. The Expo SDK 57 dev-launcher network inspector currently crashes when
the bundle URL contains the literal IPv6 host `[::1]`; use the IPv4 URL below.

```bash
NODE_OPTIONS='--dns-result-order=ipv4first' npm run start -- --localhost
# In another terminal:
MAESTRO_APP_URL='livekeys://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081' npm run test:e2e
```

Once the project is linked to EAS, run the cloud workflow manually:

```bash
npx eas-cli@latest workflow:run .eas/workflows/e2e-ios.yml
```

The workflow has no automatic trigger. GitHub Actions runs `npm run check` on Linux and the native audio tests on macOS
on pushes and pull requests.
Native E2E currently targets iOS, where this repository's audio engine is implemented.
