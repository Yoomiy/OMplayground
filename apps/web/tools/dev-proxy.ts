import type { ProxyOptions } from "vite";
import { CLASSROOM_DEV_PROXY_PATH } from "../src/lib/developmentUrls.ts";

type DevelopmentTargets = { game: string; voxel: string; classroom: string };
const defaults: DevelopmentTargets = {
  game: "http://127.0.0.1:8080",
  voxel: "http://127.0.0.1:3001",
  classroom: "http://127.0.0.1:8083"
};

/** Development routing only. Auth, origin policy and media grants stay upstream. */
export function developmentProxies(targets: DevelopmentTargets = defaults): Record<string, ProxyOptions> {
  return {
    "/api/voxel": { target: targets.voxel },
    "/voxel-media": { target: targets.voxel, ws: true },
    "/voxel": { target: targets.voxel, ws: true },
    [CLASSROOM_DEV_PROXY_PATH]: {
      target: targets.classroom,
      rewrite: (path) => path.slice(CLASSROOM_DEV_PROXY_PATH.length) || "/"
    },
    "/api": { target: targets.game },
    "/socket.io": { target: targets.game, changeOrigin: true, ws: true }
  };
}
