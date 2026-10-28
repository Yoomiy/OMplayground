import "dotenv/config";
import { createLogger } from "@playground/observability/dist/logger.js";
import { installProcessLifecycle } from "@playground/observability/dist/processLifecycle.js";
import { logError } from "@playground/observability/dist/error.js";
import { startVoxelService } from "./service.ts";
const logger = createLogger("voxel-server");
try {
  if (process.versions.node !== "24.21.0")
    throw new Error("Voxel service requires Node 24.21.0");
  const service = await startVoxelService({ logger });
  installProcessLifecycle({
    logger,
    timeoutMs: 60000,
    shutdown: () => service.close(),
  });
} catch (error) {
  // Adapter exceptions retain bounded machine codes; never pass env/request data.
  logger.error({
    message: "Voxel service startup failed",
    context: { event: "VOXEL_SERVICE_STARTUP_FAILED", status: "failed" },
    err: logError(error),
  });
  process.exitCode = 1;
}
