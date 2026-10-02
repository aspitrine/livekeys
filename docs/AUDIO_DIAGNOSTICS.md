# Audio diagnostics

## On-device trace

Open **Performance → Capturer 30 secondes**, then let the sound hold or ring out until the fault occurs.
The capture continues if you leave that screen. It saves a bounded JSON report to
`Library/Caches/livekeys-audio-diagnostic.json` in the LiveKeys app container, replacing the previous report.
The trace contains native level events, incoming MIDI events, existing DSP performance samples, active layer/settings
changes and the audio route/buffer information at the beginning and end. No extra DSP poll is made: the existing
performance monitor owns the counters, which reset on native reads.

Level events measure the signal **before the limiter**. They cannot prove the final output clips. Times indicate when
JavaScript received each event, not sample-accurate native times; thread stalls, app backgrounding and event drops must
be considered. `elapsedMs` and `droppedEvents` expose delayed completion and the 2000-event capacity limit. The report
does not contain a microphone recording, full concert backup or Audio Unit state blobs.

For an authorized local iPad diagnostic, use `xcrun devicectl device copy from` to copy this single file from the
`appDataContainer` domain for `net.eliakim.livekeys`, then inspect it locally. Do not publish private traces.
Development builds additionally support `livekeys://performance?capture=1` to open the screen and start one capture.

## Offline sampler check

`scripts/check-audio-stability.swift` measures the Apple sampler → layer mixer → master mixer → peak limiter path
using macOS AVFoundation offline rendering at 48 kHz, in 128-frame blocks. It holds a four-note chord and reports
the peak and RMS for each second, plus samples exceeding full scale and non-finite samples. Those two conditions
produce exit status 1; loading or rendering errors also fail the command.

```bash
# Continuous pad at the gain applied by a newly created + Pad layer (0.1 squared).
swift scripts/check-audio-stability.swift modules/audio-engine/ios/SoundFonts/GeneralUser-GS.sf2 89 0 0.01 90 20

# Piano played strongly, with no pad.
swift scripts/check-audio-stability.swift modules/audio-engine/ios/SoundFonts/GeneralUser-GS.sf2 0 0 0.8 127 20
```

Arguments after the bank path: program, bank number, layer gain, velocity, duration in seconds, identical layer count
(1–16), optional output WAV path. Master gain is 0.9 and the limiter is enabled. Use a bank already available locally;
do not copy a user's sound banks or saved concerts without authorization.

This is a diagnostic harness, not a substitute for an iPad audio/MIDI smoke test. It does not instantiate the full
LiveKeys engine, reproduce an Audio Unit effect, exercise pad crossfades, or measure real-time render deadlines,
audio-session changes and physical speaker output. A successful result only rules out full-scale overflow and
non-finite samples in the rendered scenario. A second-by-second RMS variation alone is not evidence of a glitch.

For an intermittent iPad fault, retain an actual recording with audio and the moment of the fault, the active patch,
output route, DSP peak/overload counters, and the iPad/app volume. A still screenshot cannot identify an audible fault.
Keep any authorized device backup in a temporary diagnostic directory, outside the repository.
