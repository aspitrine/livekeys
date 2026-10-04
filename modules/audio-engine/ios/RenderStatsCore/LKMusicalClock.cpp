#include "include/LKMusicalClock.h"
#include <algorithm>
#include <atomic>
#include <cmath>

static_assert(std::atomic<double>::is_always_lock_free, "The musical clock requires lock-free double atomics");

struct LKMusicalClock {
  std::atomic<double> tempo, sampleRate, beat{0};
  LKMusicalClock(double t, double rate) : tempo(t), sampleRate(rate) {}
};

static double clampTempo(double tempo) { return std::isfinite(tempo) ? std::min(std::max(tempo, 20.0), 300.0) : 120; }
static double validRate(double rate) { return rate > 0 && std::isfinite(rate) ? rate : 48000; }

LKMusicalClock *LKMusicalClockCreate(double tempo, double rate) {
  return new LKMusicalClock(clampTempo(tempo), validRate(rate));
}
void LKMusicalClockDestroy(LKMusicalClock *c) { delete c; }
void LKMusicalClockSetTempo(LKMusicalClock *c, double tempo) {
  c->tempo.store(clampTempo(tempo), std::memory_order_relaxed);
}
void LKMusicalClockSetSampleRate(LKMusicalClock *c, double rate) {
  c->sampleRate.store(validRate(rate), std::memory_order_relaxed);
}
void LKMusicalClockAdvance(LKMusicalClock *c, uint32_t frames) {
  const double beats = frames * c->tempo.load(std::memory_order_relaxed) /
                       (60 * c->sampleRate.load(std::memory_order_relaxed));
  // Wrap on a multiple of 4 beats (a 4/4 bar) long before double precision degrades.
  double next = c->beat.load(std::memory_order_relaxed) + beats;
  if (next >= 1 << 30) next = std::fmod(next, 4);
  c->beat.store(next, std::memory_order_relaxed);
}
LKMusicalContext LKMusicalClockRead(LKMusicalClock *c) {
  const double tempo = c->tempo.load(std::memory_order_relaxed);
  const double rate = c->sampleRate.load(std::memory_order_relaxed);
  const double beat = c->beat.load(std::memory_order_relaxed);
  const double toNextBeat = std::ceil(beat) - beat;
  return { tempo, beat, std::floor(beat / 4) * 4, int64_t(std::llround(toNextBeat * 60 / tempo * rate)) };
}
