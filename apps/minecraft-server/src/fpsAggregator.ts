// Aggregates Minecraft FPS stats per session and user in memory.
// Flushes the aggregated running averages to the database at session end.

interface FpsAccumulator {
  loadingAvg: number;
  loadingCount: number;
  runtimeAvg: number;
  runtimeCount: number;
}

const aggregations = new Map<string, Map<string, FpsAccumulator>>();

export function ingestFpsBatch(
  sessionId: string,
  userId: string,
  phase: "loading" | "runtime",
  batchAvg: number,
  batchCount: number
): void {
  if (batchCount <= 0) return;

  let sessionMap = aggregations.get(sessionId);
  if (!sessionMap) {
    sessionMap = new Map();
    aggregations.set(sessionId, sessionMap);
  }

  let accum = sessionMap.get(userId);
  if (!accum) {
    accum = {
      loadingAvg: 0,
      loadingCount: 0,
      runtimeAvg: 0,
      runtimeCount: 0
    };
    sessionMap.set(userId, accum);
  }

  if (phase === "loading") {
    const totalCount = accum.loadingCount + batchCount;
    accum.loadingAvg = (accum.loadingAvg * accum.loadingCount + batchAvg * batchCount) / totalCount;
    accum.loadingCount = totalCount;
  } else {
    const totalCount = accum.runtimeCount + batchCount;
    accum.runtimeAvg = (accum.runtimeAvg * accum.runtimeCount + batchAvg * batchCount) / totalCount;
    accum.runtimeCount = totalCount;
  }
}

export function flushFps(sessionId: string): Array<{
  userId: string;
  loadingAvg: number | null;
  loadingCount: number;
  runtimeAvg: number | null;
  runtimeCount: number;
}> {
  const sessionMap = aggregations.get(sessionId);
  if (!sessionMap) return [];
  aggregations.delete(sessionId);

  const result: Array<{
    userId: string;
    loadingAvg: number | null;
    loadingCount: number;
    runtimeAvg: number | null;
    runtimeCount: number;
  }> = [];

  for (const [userId, accum] of sessionMap.entries()) {
    result.push({
      userId,
      loadingAvg: accum.loadingCount > 0 ? accum.loadingAvg : null,
      loadingCount: accum.loadingCount,
      runtimeAvg: accum.runtimeCount > 0 ? accum.runtimeAvg : null,
      runtimeCount: accum.runtimeCount
    });
  }

  return result;
}
