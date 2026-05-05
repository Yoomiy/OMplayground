/**
 * Resolves the URL of the voxel (minecraft) game server. It is a separate
 * Railway service from the event-driven game-server, so the env variable
 * is mandatory — there is no Vite proxy fallback for this service.
 */
export function getVoxelServerUrl(): string {
  const fromEnv = import.meta.env.VITE_VOXEL_SERVER_URL?.trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) {
    return "http://localhost:8081";
  }
  throw new Error(
    "VITE_VOXEL_SERVER_URL is not set — configure it for the production build."
  );
}
