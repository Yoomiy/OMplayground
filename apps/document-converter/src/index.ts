import crypto from "crypto";
import { execFile } from "child_process";
import cors from "cors";
import express from "express";
import http from "http";
import { promises as fs, createWriteStream } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import {
  createLogger,
  correlationMiddleware,
  createHttpLogger,
  installProcessLifecycle,
  logError,
  logHttpFailure,
  observeBackgroundTask
} from "@playground/observability";

const execFileAsync = promisify(execFile);
const PORT = Number(process.env.PORT || 8082);
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const SHARED_SECRET = process.env.DOCUMENT_CONVERTER_SHARED_SECRET || "";
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_PAGES = 150;
const JOB_TTL_MS = 15 * 60_000;
const CONVERSION_TIMEOUT_MS = 120_000;

interface TicketPayload {
  roomCode: string;
  fileName: string;
  sizeBytes: number;
  sourceFormat: "pdf" | "ppt" | "pptx";
  exp: number;
  jti: string;
  correlationId?: string;
}

interface ConversionJob {
  id: string;
  accessTokenHash: string;
  directory: string;
  sourcePath: string;
  sourceFormat: TicketPayload["sourceFormat"];
  status: "queued" | "processing" | "ready" | "failed";
  pageCount?: number;
  resultPath?: string;
  error?: string;
  warning?: string;
  createdAt: number;
  roomCode: string;
  correlationId?: string;
}

const logger = createLogger("document-converter");

const jobs = new Map<string, ConversionJob>();
const usedTickets = new Map<string, number>();
const queue: string[] = [];
let workerActive = false;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function verifyTicket(token: string): TicketPayload {
  if (!SHARED_SECRET) throw new Error("converter_not_configured");
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) throw new Error("invalid_ticket");
  const expected = crypto.createHmac("sha256", SHARED_SECRET).update(encoded).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new Error("invalid_ticket");
  }
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TicketPayload;
  if (!payload.jti || payload.exp * 1000 <= Date.now()) throw new Error("expired_ticket");
  if (!Number.isInteger(payload.sizeBytes) || payload.sizeBytes < 1 || payload.sizeBytes > MAX_BYTES) {
    throw new Error("invalid_file_size");
  }
  if (!['pdf', 'ppt', 'pptx'].includes(payload.sourceFormat)) throw new Error("invalid_format");
  if (usedTickets.has(payload.jti)) throw new Error("ticket_reused");
  return payload;
}

function safeEqualToken(token: string, expectedHash: string): boolean {
  const actual = crypto.createHash("sha256").update(token).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expectedHash));
}

async function run(command: string, args: string[], cwd: string, job: ConversionJob, stage: string) {
  const startedAt = Date.now();
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      timeout: CONVERSION_TIMEOUT_MS,
      maxBuffer: 4 * 1024 * 1024
    });
    logger.info({
      correlationId: job.correlationId,
      protocol: "internal",
      message: "Document conversion stage completed",
      context: { event: "DOCUMENT_CONVERSION_STAGE_COMPLETED", jobId: job.id, stage, duration_ms: Date.now() - startedAt }
    });
    return result;
  } catch (err) {
    logger.error({
      correlationId: job.correlationId,
      protocol: "internal",
      message: "Document conversion stage failed",
      context: { event: "DOCUMENT_CONVERSION_STAGE_FAILED", jobId: job.id, stage, duration_ms: Date.now() - startedAt },
      err: logError(err)
    });
    throw err;
  }
}

function runUnlogged(command: string, args: string[], cwd: string) {
  return execFileAsync(command, args, {
    cwd,
    timeout: CONVERSION_TIMEOUT_MS,
    maxBuffer: 4 * 1024 * 1024
  });
}

async function convert(job: ConversionJob): Promise<void> {
  const startedAt = Date.now();
  job.status = "processing";
  logger.info({
    correlationId: job.correlationId,
    protocol: "http",
    message: "Document conversion started",
    context: { event: "DOCUMENT_CONVERSION_STARTED", jobId: job.id, roomCode: job.roomCode, sourceFormat: job.sourceFormat }
  });
  const outputDir = path.join(job.directory, "pages");
  await fs.mkdir(outputDir);
  let pdfPath = job.sourcePath;
  if (job.sourceFormat !== "pdf") {
    const profileDir = path.join(job.directory, "libreoffice-profile");
    await fs.mkdir(profileDir);
    const result = await run("soffice", [
      "--headless",
      `-env:UserInstallation=file://${profileDir}`,
      "--convert-to",
      "pdf",
      "--outdir",
      job.directory,
      job.sourcePath
    ], job.directory, job, "office_to_pdf");
    pdfPath = path.join(job.directory, `${path.basename(job.sourcePath, path.extname(job.sourcePath))}.pdf`);
    await fs.access(pdfPath);
    if (result.stderr.trim()) job.warning = "PowerPoint fonts or rich content may have been substituted during conversion.";
  }

  const info = await run("pdfinfo", [pdfPath], job.directory, job, "pdf_info");
  const pageMatch = info.stdout.match(/^Pages:\s+(\d+)$/m);
  const pageCount = Number(pageMatch?.[1] || 0);
  if (!pageCount) throw new Error("document_has_no_pages");
  if (pageCount > MAX_PAGES) throw new Error("document_page_limit");

  const prefix = path.join(outputDir, "page");
  await run("pdftocairo", ["-png", "-scale-to", "2560", pdfPath, prefix], job.directory, job, "rasterize");
  const pngFiles = (await fs.readdir(outputDir))
    .filter((name) => name.endsWith(".png"))
    .sort((left, right) => Number(left.match(/(\d+)\.png$/)?.[1]) - Number(right.match(/(\d+)\.png$/)?.[1]));
  if (pngFiles.length !== pageCount) throw new Error("page_rasterization_incomplete");

  const pageFiles: string[] = [];
  let useWebp = true;
  try { await runUnlogged("cwebp", ["-version"], job.directory); } catch { useWebp = false; }
  const encodeStartedAt = Date.now();
  for (let index = 0; index < pngFiles.length; index += 1) {
    const source = path.join(outputDir, pngFiles[index]);
    const fileName = `page-${String(index + 1).padStart(4, "0")}.${useWebp ? "webp" : "png"}`;
    if (useWebp) {
      await runUnlogged("cwebp", ["-quiet", "-q", "92", "-m", "4", source, "-o", path.join(outputDir, fileName)], job.directory);
      await fs.unlink(source);
    } else {
      await fs.rename(source, path.join(outputDir, fileName));
    }
    pageFiles.push(fileName);
  }
  logger.info({
    correlationId: job.correlationId,
    protocol: "internal",
    message: "Document conversion stage completed",
    context: { event: "DOCUMENT_CONVERSION_STAGE_COMPLETED", jobId: job.id, stage: "image_encode", pageCount, duration_ms: Date.now() - encodeStartedAt }
  });

  const manifest = {
    version: 1,
    pageCount,
    mimeType: useWebp ? "image/webp" : "image/png",
    pages: pageFiles,
    warning: job.warning ?? null
  };
  await fs.writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(manifest));
  const resultPath = path.join(job.directory, "result.zip");
  await run("zip", ["-q", "-j", resultPath, "manifest.json", ...pageFiles], outputDir, job, "archive");
  job.pageCount = pageCount;
  job.resultPath = resultPath;
  job.status = "ready";
  logger.info({
    correlationId: job.correlationId,
    protocol: "internal",
    message: "Document conversion completed",
    context: {
      event: "DOCUMENT_CONVERSION_COMPLETED",
      jobId: job.id,
      roomCode: job.roomCode,
      sourceFormat: job.sourceFormat,
      pageCount,
      duration_ms: Date.now() - startedAt
    }
  });
}

async function pumpQueue() {
  if (workerActive) return;
  const id = queue.shift();
  if (!id) return;
  const job = jobs.get(id);
  if (!job) return void pumpQueue();
  workerActive = true;
  try {
    await convert(job);
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : "conversion_failed";
    logger.error({
      correlationId: job.correlationId,
      protocol: "internal",
      err: logError(error),
      message: "Document conversion failed",
      context: { event: "DOCUMENT_CONVERSION_FAILED", jobId: job.id, roomCode: job.roomCode, sourceFormat: job.sourceFormat }
    });
  } finally {
    workerActive = false;
    void pumpQueue();
  }
}

async function removeJob(id: string) {
  const job = jobs.get(id);
  if (!job) return;
  const queuedIndex = queue.indexOf(id);
  if (queuedIndex >= 0) queue.splice(queuedIndex, 1);
  await fs.rm(job.directory, { recursive: true, force: true });
  jobs.delete(id);
  logger.info({
    correlationId: job.correlationId,
    protocol: "http",
    message: "Document conversion job removed",
    context: { event: "DOCUMENT_CONVERSION_REMOVED", jobId: job.id, roomCode: job.roomCode }
  });
}

const cleanupTimer = setInterval(() => {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff && job.status !== "processing") {
      observeBackgroundTask(logger, removeJob(id), "DOCUMENT_CONVERSION_TTL_CLEANUP_FAILED", { jobId: id });
    }
  }
  for (const [jti, expiresAt] of usedTickets) {
    if (expiresAt < Date.now()) usedTickets.delete(jti);
  }
}, 60_000);
cleanupTimer.unref();

const app = express();
app.set("trust proxy", 1);
app.use(correlationMiddleware());
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: false }));
app.use(createHttpLogger(logger));
app.get("/health", (_req, res) => res.json({ ok: true, queued: queue.length, workerActive }));
app.get("/ready", (_req, res) => {
  if (!SHARED_SECRET) return void res.status(503).json({ ok: false, reason: "missing_env" });
  res.json({ ok: true });
});

app.post("/v1/conversions", async (req, res) => {
  let directory: string | null = null;
  try {
    if (queue.length >= 4) return void res.status(429).json({ error: "converter_busy" });
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "") || "";
    const ticket = verifyTicket(bearer);
    usedTickets.set(ticket.jti, ticket.exp * 1000);
    if (req.headers["content-type"] !== "application/octet-stream") {
      return void res.status(415).json({ error: "binary_upload_required" });
    }
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "classroom-conversion-"));
    const sourcePath = path.join(directory, `source.${ticket.sourceFormat}`);
    const output = createWriteStream(sourcePath, { flags: "wx" });
    let received = 0;
    await new Promise<void>((resolve, reject) => {
      req.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (received > MAX_BYTES || received > ticket.sizeBytes) req.destroy(new Error("upload_too_large"));
      });
      req.on("error", reject);
      output.on("error", reject);
      output.on("finish", resolve);
      req.pipe(output);
    });
    if (received !== ticket.sizeBytes) throw new Error("upload_size_mismatch");
    const sourceBytes = Buffer.alloc(8);
    const sourceHandle = await fs.open(sourcePath, "r");
    await sourceHandle.read(sourceBytes, 0, sourceBytes.length, 0);
    await sourceHandle.close();
    const validSignature = ticket.sourceFormat === "pdf"
      ? sourceBytes.subarray(0, 5).toString("ascii") === "%PDF-"
      : ticket.sourceFormat === "pptx"
        ? sourceBytes[0] === 0x50 && sourceBytes[1] === 0x4b
        : sourceBytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    if (!validSignature) throw new Error("file_signature_mismatch");
    const id = crypto.randomUUID();
    const accessToken = base64url(crypto.randomBytes(32));
    jobs.set(id, {
      id,
      accessTokenHash: crypto.createHash("sha256").update(accessToken).digest("hex"),
      directory,
      sourcePath,
      sourceFormat: ticket.sourceFormat,
      status: "queued",
      createdAt: Date.now(),
      roomCode: ticket.roomCode,
      correlationId: ticket.correlationId ?? (req as express.Request & { correlationId?: string }).correlationId
    });
    queue.push(id);
    logger.info({
      correlationId: ticket.correlationId ?? (req as express.Request & { correlationId?: string }).correlationId,
      protocol: "http",
      message: "Document conversion job accepted",
      context: { event: "DOCUMENT_CONVERSION_ACCEPTED", jobId: id, roomCode: ticket.roomCode, sourceFormat: ticket.sourceFormat, sizeBytes: ticket.sizeBytes, queueDepth: queue.length }
    });
    void pumpQueue();
    res.status(202).json({ id, accessToken });
  } catch (error) {
    logHttpFailure(logger, req, error, "DOCUMENT_CONVERSION_UPLOAD_REJECTED", {}, "warn");
    if (directory) {
      try {
        await fs.rm(directory, { recursive: true, force: true });
      } catch (cleanupError) {
        logHttpFailure(logger, req, cleanupError, "DOCUMENT_CONVERSION_UPLOAD_CLEANUP_FAILED");
      }
    }
    if (!res.headersSent) res.status(400).json({ error: "upload_rejected" });
  }
});

function authorizedJob(req: express.Request, res: express.Response): ConversionJob | null {
  const job = jobs.get(req.params.id);
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") || "";
  if (!job || !token || !safeEqualToken(token, job.accessTokenHash)) {
    res.status(404).json({ error: "conversion_not_found" });
    return null;
  }
  return job;
}

app.get("/v1/conversions/:id", (req, res) => {
  const job = authorizedJob(req, res);
  if (!job) return;
  res.json({ status: job.status, pageCount: job.pageCount, warning: job.warning, error: job.error });
});

app.get("/v1/conversions/:id/result", (req, res) => {
  const job = authorizedJob(req, res);
  if (!job) return;
  if (job.status !== "ready" || !job.resultPath) return void res.status(409).json({ error: "conversion_not_ready" });
  res.download(job.resultPath, "presentation-pages.zip", (err) => {
    if (err) {
      logHttpFailure(logger, req, err, "DOCUMENT_CONVERSION_DOWNLOAD_FAILED", { jobId: job.id });
      return;
    }
    logger.info({ correlationId: job.correlationId, protocol: "http", message: "Document conversion result downloaded", context: { event: "DOCUMENT_CONVERSION_DOWNLOADED", jobId: job.id, roomCode: job.roomCode } });
  });
});

app.delete("/v1/conversions/:id", async (req, res) => {
  const job = authorizedJob(req, res);
  if (!job) return;
  if (job.status === "processing") return void res.status(409).json({ error: "conversion_in_progress" });
  try {
    await removeJob(job.id);
    res.status(204).end();
  } catch (err) {
    logHttpFailure(logger, req, err, "DOCUMENT_CONVERSION_DELETE_FAILED", { jobId: job.id });
    res.status(500).json({ error: "internal_server_error" });
  }
});

const server = http.createServer(app);
server.listen(PORT, () => logger.info({ protocol: "http", message: "document-converter listening", context: { event: "SERVICE_LISTENING", port: PORT } }));

installProcessLifecycle({
  logger,
  shutdown: async () => {
    clearInterval(cleanupTimer);
    await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    if (queue.length > 0) {
      logger.warn({
        message: "Queued conversions will not start during shutdown",
        context: { event: "DOCUMENT_CONVERSION_SHUTDOWN_QUEUE_DROPPED", queuedJobs: queue.length }
      });
    }
    while (workerActive) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
});
