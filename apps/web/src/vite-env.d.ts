/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_GAME_SERVER_URL: string;
  readonly VITE_CLASSROOM_SERVER_URL?: string;
  readonly VITE_VOXEL_RUNTIME_SERVER_URL?: string;
  readonly VITE_ROCKET_SERVICE_URL?: string;
  readonly VITE_WOBBLE_SERVICE_URL?: string;
  readonly VITE_LIVEKIT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
