#pragma once
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif
typedef struct LKMusicalClock LKMusicalClock;
/// What an AUv3 host musical context block reports (4/4 time).
typedef struct {
  double tempo;
  double beatPosition;
  double measureDownbeatPosition;
  int64_t sampleOffsetToNextBeat;
} LKMusicalContext;

LKMusicalClock *LKMusicalClockCreate(double tempo, double sampleRate);
void LKMusicalClockDestroy(LKMusicalClock *clock);
// Any thread. Out-of-range values are clamped to 20...300 BPM; the beat position stays continuous.
void LKMusicalClockSetTempo(LKMusicalClock *clock, double tempo);
void LKMusicalClockSetSampleRate(LKMusicalClock *clock, double sampleRate);
// Single audio producer, once per rendered buffer. No allocation or mutex.
void LKMusicalClockAdvance(LKMusicalClock *clock, uint32_t frames);
// Any thread, including Audio Unit render threads. Lock-free.
LKMusicalContext LKMusicalClockRead(LKMusicalClock *clock);
#ifdef __cplusplus
}
#endif
