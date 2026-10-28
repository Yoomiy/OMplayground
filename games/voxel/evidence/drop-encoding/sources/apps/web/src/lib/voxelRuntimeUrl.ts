/** Independent rewritten voxel service; classrooms have their own endpoint. */
export function getVoxelRuntimeUrl(): string {
  const value = import.meta.env.VITE_VOXEL_RUNTIME_SERVER_URL?.trim();
  if (value) return value;
  if (import.meta.env.DEV) return "http://localhost:3001";
  throw new Error("VOXEL_RUNTIME_CONFIGURATION");
}
