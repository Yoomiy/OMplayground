export const CLASSROOM_DEV_PROXY_PATH = "/__classroom";

/** Use the browser's actual forwarded origin, rather than its own backend ports. */
export function developmentOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
}
