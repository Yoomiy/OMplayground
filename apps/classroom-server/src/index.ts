import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  createLogger,
  installProcessLifecycle,
  logError,
} from "@playground/observability";
import { readClassroomConfig } from "./config";
import { createClassroomService } from "./service";

const logger = createLogger("classroom-server");
async function main() {
  if (process.versions.node !== "24.21.0")
    throw new Error("Classroom service requires Node 24.21.0");
  const config = readClassroomConfig();
  const supabaseAdmin = createClient(config.supabaseUrl, config.signingSecret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const service = createClassroomService({ config, supabaseAdmin, logger });
  installProcessLifecycle({
    logger,
    timeoutMs: 60_000,
    shutdown: () => service.close(),
  });
  try {
    const address = await service.listen();
    logger.info({
      message: "Classroom service listening",
      protocol: "http",
      context: { event: "SERVICE_LISTENING", port: address.port },
    });
  } catch (error) {
    await service.close();
    throw error;
  }
}
void main().catch((error) => {
  logger.fatal({
    message: "Classroom service startup failed",
    context: { event: "CLASSROOM_SERVICE_STARTUP_FAILED" },
    err: logError(error),
  });
  process.exitCode = 1;
});
