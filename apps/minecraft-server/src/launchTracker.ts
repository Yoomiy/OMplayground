// In-memory launch tracker for game session player launches.
// Keeps track of counts of player launches per session in memory, to be flushed at session end.

const launches = new Map<string, Map<string, { gameUrl: string; count: number }>>();

export function recordLaunch(sessionId: string, userId: string, gameUrl: string): void {
  let sessionLaunches = launches.get(sessionId);
  if (!sessionLaunches) {
    sessionLaunches = new Map();
    launches.set(sessionId, sessionLaunches);
  }
  const current = sessionLaunches.get(userId) || { gameUrl, count: 0 };
  current.count += 1;
  sessionLaunches.set(userId, current);
}

export function flushLaunches(
  sessionId: string,
  keepSession = false
): Array<{ userId: string; gameUrl: string; count: number }> {
  const sessionLaunches = launches.get(sessionId);
  if (!sessionLaunches) return [];
  
  const result: Array<{ userId: string; gameUrl: string; count: number }> = [];
  for (const [userId, record] of sessionLaunches.entries()) {
    if (record.count > 0) {
      result.push({ userId, gameUrl: record.gameUrl, count: record.count });
      if (keepSession) {
        record.count = 0;
      }
    }
  }
  
  if (!keepSession) {
    launches.delete(sessionId);
  }
  
  return result;
}
