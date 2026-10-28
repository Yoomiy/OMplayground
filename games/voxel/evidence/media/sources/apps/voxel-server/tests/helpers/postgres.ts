import { readFileSync } from "node:fs";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
const execute = promisify(execFile);
export const literal = (value: unknown) =>
  `'${String(value).replaceAll("'", "''")}'`;
export const json = (value: unknown) =>
  `${literal(JSON.stringify(value))}::jsonb`;
export class PostgresTestDatabase {
  readonly name = `voxel_test_${randomUUID().replaceAll("-", "")}`;
  private bin: string;
  private connection: string[];
  constructor() {
    if (process.env.VOXEL_TEST_POSTGRES !== "1")
      throw new Error("Set VOXEL_TEST_POSTGRES=1 for isolated database tests");
    const host = process.env.PGHOST ?? "127.0.0.1";
    if (!["127.0.0.1", "localhost", "::1"].includes(host))
      throw new Error("Postgres tests require a local cluster");
    this.bin = process.env.VOXEL_PG_BIN ?? "";
    this.connection = [
      "-h",
      host,
      "-p",
      process.env.PGPORT ?? "5432",
      "-U",
      process.env.PGUSER ?? "postgres",
    ];
    execFileSync(join(this.bin, "createdb"), [...this.connection, this.name], {
      stdio: "pipe",
    });
    try {
      execFileSync(
        join(this.bin, "psql"),
        [
          ...this.connection,
          "-d",
          this.name,
          "-X",
          "-q",
          "-v",
          "ON_ERROR_STOP=1",
          "--single-transaction",
          "-f",
          fileURLToPath(new URL("../schema-bootstrap.sql", import.meta.url)),
          "-f",
          fileURLToPath(
            new URL(
              "../../../../supabase/migrations/20261025010000_voxel_checkpoint_storage.sql",
              import.meta.url,
            ),
          ),
        ],
        { stdio: "pipe" },
      );
    } catch (error) {
      this.close();
      throw error;
    }
  }
  installSessionProjection() {
    for (const path of [
      "../session-bootstrap.sql",
      "../../../../supabase/migrations/20261025020000_voxel_session_projection.sql",
    ])
      this.exec(readFileSync(new URL(path, import.meta.url), "utf8"));
  }
  installRoster() {
    this.exec(
      readFileSync(
        new URL(
          "../../../../supabase/migrations/20261025040000_voxel_roster_departure.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
  }
  installSessionControls() {
    this.installSessionProjection();
    for (const path of [
      "../control-bootstrap.sql",
      "../../../../supabase/migrations/20261025030000_voxel_session_controls.sql",
    ])
      this.exec(readFileSync(new URL(path, import.meta.url), "utf8"));
    this.installRoster();
    this.exec(
      readFileSync(
        new URL(
          "../../../../supabase/migrations/20261025050000_voxel_staff_commands.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    this.installModeration();
    this.installChat();
    this.installMedia();
  }
  installChat() {
    this.exec(
      readFileSync(
        new URL(
          "../../../../supabase/migrations/20261025070000_voxel_chat.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
  }
  installMedia() {
    this.exec(
      readFileSync(
        new URL(
          "../../../../supabase/migrations/20261025080000_voxel_media.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
  }
  installModeration() {
    this.exec(
      readFileSync(
        new URL(
          "../../../../supabase/migrations/20261025060000_voxel_moderation.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
  }
  private args(sql: string, role: string) {
    if (!["service_role", "anon", "authenticated", ""].includes(role))
      throw new Error("invalid test role");
    return [
      ...this.connection,
      "-d",
      this.name,
      "-X",
      "-q",
      "-A",
      "-t",
      "-v",
      "ON_ERROR_STOP=1",
      "-v",
      "VERBOSITY=verbose",
      "-c",
      `${role ? `SET ROLE ${role};` : ""}${sql}`,
    ];
  }
  exec(sql: string, role = ""): string {
    return execFileSync(join(this.bin, "psql"), this.args(sql, role), {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  }
  async execAsync(sql: string, role = ""): Promise<string> {
    const result = await execute(join(this.bin, "psql"), this.args(sql, role), {
      encoding: "utf8",
    });
    return result.stdout.trim();
  }
  value(expression: string, role = ""): any {
    return JSON.parse(
      this.exec(
        `SELECT coalesce(to_jsonb((${expression})),'null'::jsonb)`,
        role,
      ),
    );
  }
  async valueAsync(expression: string, role = ""): Promise<any> {
    return JSON.parse(
      await this.execAsync(
        `SELECT coalesce(to_jsonb((${expression})),'null'::jsonb)`,
        role,
      ),
    );
  }
  rpc(name: string, args: Record<string, unknown>, role = "service_role"): any {
    return this.value(this.call(name, args), role);
  }
  rpcAsync(
    name: string,
    args: Record<string, unknown>,
    role = "service_role",
  ): Promise<any> {
    return this.valueAsync(this.call(name, args), role);
  }
  call(name: string, args: Record<string, unknown>) {
    const names = [
      "voxel_media_authorize",
      "voxel_media_moderate",
      "voxel_media_state",
      "voxel_media_status",
      "voxel_chat_history",
      "voxel_chat_send",
      "voxel_chat_moderate",
      "voxel_chat_status",
      "voxel_controls_status",
      "voxel_actor_policy",
      "voxel_moderate",
      "voxel_moderation_receipt",
      "voxel_moderation_status",
      "voxel_moderation_targets",
      "voxel_control_receipt",
      "voxel_begin_control",
      "voxel_finish_control",
      "voxel_session_projection_status",
      "voxel_initialize_session",
      "voxel_accept_member",
      "voxel_accept_member_revision",
      "voxel_leave_roster",
      "voxel_roster_status",
      "voxel_staff_status",
      "voxel_staff_receipt",
      "voxel_begin_staff",
      "voxel_finish_staff",
      "voxel_project_session",
      "voxel_session_policy",
      "voxel_acquire_room",
      "voxel_renew_room",
      "voxel_release_room",
      "voxel_prepare_object",
      "voxel_complete_object",
      "voxel_commit_checkpoint",
      "voxel_persistence_status",
      "voxel_prune_checkpoints",
      "voxel_claim_garbage",
      "voxel_finish_garbage",
    ];
    const types: Record<string, string> = {
      p_participation: "text",
      p_media_revision: "bigint",
      p_before: "bigint",
      p_message: "text",
      p_session: "uuid",
      p_actor: "uuid",
      p_target: "uuid",
      p_request: "uuid",
      p_action: "text",
      p_authorized_until: "timestamptz",
      p_saved: "bigint",
      p_revision: "bigint",
      p_command: "jsonb",
      p_result: "jsonb",
      p_sequence: "bigint",
      p_state: "text",
      p_participants: "uuid[]",
      p_world: "uuid",
      p_owner: "uuid",
      p_epoch: "bigint",
      p_previous: "bigint",
      p_pointer: "jsonb",
      p_objects: "jsonb",
      p_object: "jsonb",
      p_key: "text",
      p_token: "uuid",
      p_limit: "integer",
    };
    if (
      !names.includes(name) ||
      Object.keys(args).some((key) => !Object.hasOwn(types, key))
    )
      throw new Error("invalid test RPC");
    const params = Object.entries(args).map(
      ([key, value]) =>
        `${key} => ${value === null ? `NULL::${types[key]}` : types[key] === "jsonb" ? json(value) : types[key] === "uuid[]" ? `ARRAY[${(value as string[]).map(literal).join(",")}]::uuid[]` : `${literal(value)}::${types[key]}`}`,
    );
    if (name === "voxel_claim_garbage")
      return `SELECT coalesce(jsonb_agg(v),'[]'::jsonb) FROM public.${name}(${params.join(",")}) AS v`;
    return `public.${name}(${params.join(",")})`;
  }
  session() {
    const id = randomUUID();
    this.exec(
      `INSERT INTO public.game_sessions(id) VALUES(${literal(id)}::uuid)`,
    );
    return id;
  }
  async waitForAdvisory(key: number) {
    for (let i = 0; i < 100; i++) {
      if (
        this.value(
          `SELECT EXISTS(SELECT FROM pg_locks WHERE locktype='advisory' AND objid=${key} AND granted)`,
        )
      )
        return;
      await delay(10);
    }
    throw new Error("test transaction did not reach its lock barrier");
  }
  close() {
    execFileSync(
      join(this.bin, "dropdb"),
      [...this.connection, "--if-exists", "--force", this.name],
      { stdio: "pipe" },
    );
  }
}
