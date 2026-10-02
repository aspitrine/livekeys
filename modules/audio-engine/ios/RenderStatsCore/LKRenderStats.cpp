#include "include/LKRenderStats.h"
#include <atomic>
#include <algorithm>
#include <cmath>

static_assert(ATOMIC_LLONG_LOCK_FREE == 2, "Render statistics require lock-free 64-bit atomics");
static_assert(ATOMIC_INT_LOCK_FREE == 2, "Render statistics require lock-free rate reads");

struct LKRenderStats {
  const double secondsPerTick;
  std::atomic<uint32_t> sampleRate;
  // Only the serial audio callback accesses start; the reader never copies it.
  uint64_t start = 0;
  // A single exchange snapshots sum + count together. 24 count bits, 40 sum bits;
  // fixed-point load has 1/1024 resolution. Saturation avoids wrap after long pauses.
  std::atomic<unsigned long long> sumAndCount{0}, peak{0}, overloads{0};
  LKRenderStats(double tick, double rate) : secondsPerTick(tick), sampleRate(uint32_t(rate)) {}
};
static constexpr uint64_t countMask = (1ULL << 24) - 1;
static constexpr uint64_t sumMask = (1ULL << 40) - 1;

LKRenderStats *LKRenderStatsCreate(double tick, double rate) { return new LKRenderStats(tick, rate); }
void LKRenderStatsDestroy(LKRenderStats *s) { delete s; }
void LKRenderStatsSetSampleRate(LKRenderStats *s, double rate) {
  s->sampleRate.store(uint32_t(rate > 0 && std::isfinite(rate) ? rate : 48000), std::memory_order_relaxed);
}
void LKRenderStatsPreRender(LKRenderStats *s, uint64_t ticks) { s->start = ticks; }
void LKRenderStatsPostRender(LKRenderStats *s, uint64_t ticks, uint32_t frames) {
  if (!s->start || !frames) return;
  const double load = double(ticks - s->start) * s->secondsPerTick * s->sampleRate.load(std::memory_order_relaxed) / frames;
  s->start = 0;
  LKRenderStatsRecord(s, load);
}
void LKRenderStatsRecord(LKRenderStats *s, double load) {
  if (!std::isfinite(load) || load < 0) return;
  const uint64_t value = uint64_t(std::min(load, 1000.0) * 1024 + 0.5);
  auto old = s->sumAndCount.load(std::memory_order_relaxed);
  for (;;) {
    const uint64_t count = std::min((old & countMask) + 1, countMask);
    const uint64_t sum = std::min((old >> 24) + value, sumMask);
    const uint64_t next = (sum << 24) | count;
    if (s->sumAndCount.compare_exchange_weak(old, next, std::memory_order_relaxed)) break;
  }
  old = s->peak.load(std::memory_order_relaxed);
  while (old < value && !s->peak.compare_exchange_weak(old, value, std::memory_order_relaxed)) {}
  if (load > 1) s->overloads.fetch_add(1, std::memory_order_relaxed);
}
LKRenderSnapshot LKRenderStatsRead(LKRenderStats *s) {
  const uint64_t packed = s->sumAndCount.exchange(0, std::memory_order_relaxed);
  const uint64_t count = packed & countMask;
  // Peak / overload boundaries may differ by a cycle from the average window.
  return { count ? double(packed >> 24) / (1024 * count) : 0,
    double(s->peak.exchange(0, std::memory_order_relaxed)) / 1024, count,
    s->overloads.exchange(0, std::memory_order_relaxed) };
}
