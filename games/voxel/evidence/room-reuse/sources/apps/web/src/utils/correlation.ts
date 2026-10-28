const STORAGE_KEY = "playground_correlation_id";

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `c-${crypto.randomUUID()}`;
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getCorrelationId(): string {
  if (typeof sessionStorage === "undefined") return randomId();
  const existing = sessionStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const id = randomId();
  sessionStorage.setItem(STORAGE_KEY, id);
  return id;
}

export function resetCorrelationId(): string {
  const id = randomId();
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
