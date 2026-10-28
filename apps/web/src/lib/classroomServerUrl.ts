import { CLASSROOM_DEV_PROXY_PATH, developmentOrigin } from "./developmentUrls";
/** Classroom admission, moderation and RTC run independently from game workers. */
export function getClassroomServerUrl(): string {
  const value = import.meta.env.VITE_CLASSROOM_SERVER_URL?.trim();
  if (value) return value.replace(/\/+$/, "");
  if (import.meta.env.DEV) return developmentOrigin() + CLASSROOM_DEV_PROXY_PATH;
  throw new Error("CLASSROOM_CONFIGURATION");
}
