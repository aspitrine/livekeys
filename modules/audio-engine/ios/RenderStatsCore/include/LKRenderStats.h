#pragma once
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif
typedef struct LKRenderStats LKRenderStats;
typedef struct {
  double average;
  double peak;
  uint64_t count;
  uint64_t overloads;
} LKRenderSnapshot;

LKRenderStats *LKRenderStatsCreate(double secondsPerTick, double sampleRate);
void LKRenderStatsDestroy(LKRenderStats *stats);
void LKRenderStatsSetSampleRate(LKRenderStats *stats, double sampleRate);
// Single audio producer. No allocation or mutex on the render path.
void LKRenderStatsPreRender(LKRenderStats *stats, uint64_t ticks);
void LKRenderStatsPostRender(LKRenderStats *stats, uint64_t ticks, uint32_t frames);
// Also used by the concurrency regression test to exercise the actual accumulator.
void LKRenderStatsRecord(LKRenderStats *stats, double load);
LKRenderSnapshot LKRenderStatsRead(LKRenderStats *stats);
#ifdef __cplusplus
}
#endif
