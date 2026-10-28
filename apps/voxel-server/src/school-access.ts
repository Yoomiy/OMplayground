import type { SupabaseClient } from "@supabase/supabase-js";
import { isWithinEffectiveRecess } from "@playground/game-logic/dist/recessSchedule.js";
import type {
  RecessWindow,
  ClassRecessException,
} from "@playground/game-logic/dist/recessSchedule.js";
import type { AdmittedActor } from "../../../games/voxel/src/sim/game-room.ts";
import type {
  AdmissionGrant,
  Authorization,
} from "../../../games/voxel/src/server/admission.ts";
import type { RoomPolicy } from "../../../games/voxel/src/server/room-policy.ts";
import { SessionEnded } from "../../../games/voxel/src/server/admission.ts";

export const AUTHORIZATION_MS = 5000;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export type Participation = "player" | "observer";
export type SchoolAdmissionRequest = Readonly<{
  room: string;
  invitationCode?: string;
  participation?: Participation;
}>;
export type Subject = Readonly<{
  id: string;
  role: "kid" | "teacher" | "admin";
  gender: "boy" | "girl" | null;
  grade: string | null;
}>;
export type SessionAccess = Readonly<{
  id: string;
  hostId: string;
  playerIds: readonly string[];
  status: "waiting" | "playing" | "paused" | "completed";
  isOpen: boolean;
  rosterRevision: number;
}>;
export type SchoolAuthorization = Readonly<{
  actor: AdmittedActor;
  expiresAt: number;
  subject: Subject;
  session: SessionAccess;
  controls: boolean;
  policy: Readonly<{
    revision: number;
    acceptedRevision: number;
    banned: boolean;
  }>;
}>;
export class AccessDenied extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
export class SchoolUnavailable extends Error {
  constructor() {
    super("SCHOOL_POLICY_UNAVAILABLE");
  }
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const uuid = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);
function deny(code: string): never {
  throw new AccessDenied(code);
}
function window(value: unknown): value is RecessWindow {
  if (
    !record(value) ||
    !Number.isInteger(value.day_of_week) ||
    (value.day_of_week as number) < 0 ||
    (value.day_of_week as number) > 6 ||
    typeof value.is_active !== "boolean" ||
    typeof value.start_time !== "string" ||
    typeof value.end_time !== "string"
  )
    return false;
  const time = (text: string) =>
    /^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:\.[0-9]{1,6})?)?$/.test(
      text,
    ) || /^24:00(?::00(?:\.0{1,6})?)?$/.test(text);
  return (
    time(value.start_time) &&
    time(value.end_time) &&
    value.start_time < value.end_time
  );
}
function checkedInput(input: SchoolAdmissionRequest): SchoolAdmissionRequest {
  if (
    !record(input) ||
    !uuid(input.room) ||
    Object.keys(input).some(
      (key) => !["room", "invitationCode", "participation"].includes(key),
    ) ||
    (input.invitationCode !== undefined &&
      (typeof input.invitationCode !== "string" ||
        input.invitationCode.length > 128)) ||
    (input.participation !== undefined &&
      !["player", "observer"].includes(input.participation))
  )
    deny("INVALID");
  return Object.freeze({
    ...input,
    ...(input.invitationCode === undefined
      ? {}
      : { invitationCode: input.invitationCode.trim() }),
  });
}
/** Only verified identity and fresh platform rows grant school access. No auth/profile cache. */
export class SchoolAccess {
  private client: SupabaseClient;
  private now: () => number;
  constructor(client: SupabaseClient, now: () => number = Date.now) {
    this.client = client;
    this.now = now;
  }
  private async row(query: {
    retry: (enabled: boolean) => PromiseLike<{ data: unknown; error: unknown }>;
  }): Promise<unknown> {
    try {
      const result = await query.retry(false);
      if (result.error) throw new SchoolUnavailable();
      return result.data;
    } catch {
      throw new SchoolUnavailable();
    }
  }
  private async actorPolicy(room: string, id: string) {
    const value = await this.row(
      this.client.rpc("voxel_actor_policy", { p_session: room, p_actor: id }),
    );
    if (
      !record(value) ||
      Object.keys(value).length !== 3 ||
      !Number.isSafeInteger(value.revision) ||
      (value.revision as number) < 0 ||
      !Number.isSafeInteger(value.acceptedRevision) ||
      (value.acceptedRevision as number) < 0 ||
      typeof value.banned !== "boolean" ||
      (value.revision === 0 && (value.banned || value.acceptedRevision !== 0))
    )
      throw new SchoolUnavailable();
    return Object.freeze({
      revision: value.revision as number,
      acceptedRevision: value.acceptedRevision as number,
      banned: value.banned,
    });
  }
  async profile(id: string): Promise<Subject | null> {
    if (!uuid(id)) return null;
    const value = await this.row(
      this.client
        .from("kid_profiles")
        .select("id,role,gender,grade,is_active")
        .eq("id", id)
        .maybeSingle(),
    );
    if (value !== null) {
      if (
        !record(value) ||
        value.id !== id ||
        !["kid", "teacher"].includes(value.role as string) ||
        !["boy", "girl"].includes(value.gender as string) ||
        typeof value.is_active !== "boolean" ||
        (value.grade !== null && typeof value.grade !== "string")
      )
        throw new SchoolUnavailable();
      if (!value.is_active) return null;
      return Object.freeze({
        id,
        role: value.role as "kid" | "teacher",
        gender: value.gender as "boy" | "girl",
        grade: value.grade as string | null,
      });
    }
    const admin = await this.row(
      this.client
        .from("admin_profiles")
        .select("id")
        .eq("id", id)
        .maybeSingle(),
    );
    if (admin === null) return null;
    if (!record(admin) || admin.id !== id) throw new SchoolUnavailable();
    return Object.freeze({ id, role: "admin", gender: null, grade: null });
  }
  async identity(
    token: string,
  ): Promise<Readonly<{ subject: Subject; expiresAt: number }>> {
    return this.authenticate(token);
  }
  private async authenticate(
    token: string,
  ): Promise<{ subject: Subject; expiresAt: number }> {
    if (
      typeof token !== "string" ||
      token.length > 16384 ||
      token.split(".").length !== 3
    )
      deny("UNAUTHORIZED");
    let id: string;
    try {
      const result = await this.client.auth.getUser(token);
      if (result.error) {
        const status = (result.error as { status?: number }).status;
        if (status === 400 || status === 401 || status === 403)
          deny("UNAUTHORIZED");
        throw new SchoolUnavailable();
      }
      if (!uuid(result.data.user?.id)) deny("UNAUTHORIZED");
      id = result.data.user!.id;
    } catch (error) {
      if (error instanceof AccessDenied) throw error;
      throw new SchoolUnavailable();
    }
    // The Auth service has already verified this JWT; decoding only bounds our lease.
    let expiresAt: number;
    try {
      const claims: unknown = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
      );
      if (
        !record(claims) ||
        claims.sub !== id ||
        !Number.isSafeInteger(claims.exp) ||
        (claims.exp as number) <= 0
      )
        deny("UNAUTHORIZED");
      expiresAt = (claims.exp as number) * 1000;
      if (!Number.isSafeInteger(expiresAt) || expiresAt <= this.now())
        deny("UNAUTHORIZED");
    } catch {
      return deny("UNAUTHORIZED");
    }
    const subject = await this.profile(id);
    if (!subject) deny("FORBIDDEN");
    return { subject, expiresAt };
  }
  private async session(room: string, includeEnded = false) {
    const value = await this.row(
      this.client
        .from("game_sessions")
        .select(
          "id,host_id,player_ids,gender,status,is_open,invitation_code,voxel_roster_revision,games(game_url,is_active)",
        )
        .eq("id", room)
        .maybeSingle(),
    );
    if (value === null) deny("NOT_FOUND");
    if (
      !record(value) ||
      value.id !== room ||
      !uuid(value.host_id) ||
      !Array.isArray(value.player_ids) ||
      !value.player_ids.every(uuid) ||
      !["boy", "girl"].includes(value.gender as string) ||
      !["waiting", "playing", "paused", "completed"].includes(
        value.status as string,
      ) ||
      !Number.isSafeInteger(value.voxel_roster_revision) ||
      (value.voxel_roster_revision as number) < 0 ||
      typeof value.is_open !== "boolean" ||
      typeof value.invitation_code !== "string" ||
      !record(value.games) ||
      typeof value.games.game_url !== "string" ||
      typeof value.games.is_active !== "boolean"
    )
      throw new SchoolUnavailable();
    if (value.games.game_url !== "minecraft" || !value.games.is_active)
      deny("WRONG_GAME");
    if (value.status === "completed" && !includeEnded) deny("SESSION_ENDED");
    return {
      view: Object.freeze({
        id: room,
        hostId: value.host_id,
        playerIds: Object.freeze([...value.player_ids]),
        status: value.status as SessionAccess["status"],
        isOpen: value.is_open,
        rosterRevision: value.voxel_roster_revision as number,
      }),
      gender: value.gender,
      invitationCode: value.invitation_code,
    };
  }
  /** Read-only UI scope. Completion remains visible to its roster and current staff. */
  async inspect(
    token: string,
    input: SchoolAdmissionRequest,
  ): Promise<{ expiresAt: number }> {
    const request = checkedInput(input);
    try {
      return await this.authorize(token, request);
    } catch (error) {
      if (!(error instanceof AccessDenied) || error.code !== "SESSION_ENDED")
        throw error;
      const started = this.now(),
        auth = await this.authenticate(token),
        session = await this.session(request.room, true);
      if (session.view.status !== "completed")
        return this.authorize(token, request);
      if (
        auth.subject.role === "kid" &&
        (await this.actorPolicy(request.room, auth.subject.id)).banned
      )
        deny("BANNED");
      if (
        auth.subject.role === "kid" &&
        (auth.subject.gender !== session.gender ||
          (session.view.hostId !== auth.subject.id &&
            !session.view.playerIds.includes(auth.subject.id)))
      )
        deny("FORBIDDEN");
      const expiresAt = Math.min(auth.expiresAt, started + AUTHORIZATION_MS);
      if (this.now() >= expiresAt || this.now() < started)
        throw new SchoolUnavailable();
      return { expiresAt };
    }
  }
  private async recess(subject: Subject): Promise<{
    defaults: RecessWindow[];
    setting: boolean;
    exceptions: ClassRecessException[];
  }> {
    if (!subject.grade || !subject.gender) deny("RECESS_CLOSED");
    const [defaults, setting, exceptions] = await Promise.all([
      this.row(
        this.client
          .from("recess_schedules")
          .select("day_of_week,start_time,end_time,is_active")
          .eq("is_active", true),
      ),
      this.row(
        this.client
          .from("class_recess_schedule_settings")
          .select("override_enabled")
          .eq("grade", subject.grade)
          .eq("gender", subject.gender)
          .maybeSingle(),
      ),
      this.row(
        this.client
          .from("class_recess_schedule_exceptions")
          .select("day_of_week,start_time,end_time,is_active,mode")
          .eq("grade", subject.grade)
          .eq("gender", subject.gender)
          .eq("is_active", true),
      ),
    ]);
    if (
      !Array.isArray(defaults) ||
      !defaults.every(window) ||
      (setting !== null &&
        (!record(setting) || typeof setting.override_enabled !== "boolean")) ||
      !Array.isArray(exceptions) ||
      !exceptions.every(
        (entry) =>
          window(entry) &&
          record(entry) &&
          ["recess", "class_time"].includes(entry.mode as string),
      )
    )
      throw new SchoolUnavailable();
    const typed = exceptions as ClassRecessException[];
    // The database rejects overlaps. Reject corrupt/conflicting snapshots rather than choosing a grant by row order.
    for (let i = 0; i < typed.length; i++)
      for (let j = i + 1; j < typed.length; j++)
        if (
          typed[i].day_of_week === typed[j].day_of_week &&
          typed[i].is_active &&
          typed[j].is_active &&
          typed[i].start_time < typed[j].end_time &&
          typed[j].start_time < typed[i].end_time
        )
          throw new SchoolUnavailable();
    return {
      defaults: defaults as RecessWindow[],
      setting:
        setting !== null &&
        (setting as { override_enabled: boolean }).override_enabled,
      exceptions: typed,
    };
  }
  async authorize(
    token: string,
    input: SchoolAdmissionRequest,
  ): Promise<SchoolAuthorization> {
    const request = checkedInput(input),
      started = this.now(),
      authenticated = await this.authenticate(token);
    return this.evaluate(
      authenticated.subject,
      request,
      started,
      authenticated.expiresAt,
      true,
    );
  }
  async grant(
    token: string,
    input: SchoolAdmissionRequest,
  ): Promise<AdmissionGrant> {
    const request = checkedInput(input);
    const select = (checked: SchoolAuthorization): Authorization =>
      Object.freeze({
        actor: checked.actor,
        expiresAt: checked.expiresAt,
        membershipRevision: checked.session.rosterRevision,
      });
    const checkedInitial = await this.authorize(token, request),
      initial = select(checkedInitial);
    return Object.freeze({
      ...initial,
      revalidate: async (stage = "ticket") => {
        try {
          const checked = await this.authorize(token, request);
          if (
            checked.actor.role === "participant" &&
            (checked.policy.revision > checkedInitial.session.rosterRevision ||
              (stage === "actor" &&
                (!checked.session.playerIds.includes(checked.subject.id) ||
                  checked.policy.revision > checked.policy.acceptedRevision)) ||
              (stage === "ticket" &&
                checked.session.rosterRevision !==
                  checkedInitial.session.rosterRevision))
          )
            deny("MEMBERSHIP_REVOKED");
          return select(checked);
        } catch (error) {
          if (
            error instanceof AccessDenied &&
            ["SESSION_ENDED", "NOT_FOUND", "WRONG_GAME"].includes(error.code)
          )
            throw new SessionEnded();
          if (error instanceof AccessDenied) return null;
          throw error;
        }
      },
    });
  }
  private async evaluate(
    subject: Subject,
    request: SchoolAdmissionRequest,
    started: number,
    tokenExpiresAt: number,
    checkRecess: boolean,
  ): Promise<SchoolAuthorization> {
    const session = await this.session(request.room),
      staff = subject.role !== "kid";
    const participation =
      request.participation ?? (staff ? "observer" : "player");
    if (
      (participation === "observer" && !staff) ||
      (participation === "player" && subject.role === "admin")
    )
      deny("MODE_DENIED");
    const observing = participation === "observer";
    if (!observing && subject.gender !== session.gender)
      deny("GENDER_MISMATCH");
    const policy = staff
      ? { revision: 0, acceptedRevision: 0, banned: false }
      : await this.actorPolicy(request.room, subject.id);
    if (policy.banned) deny("BANNED");
    if (policy.revision > session.view.rosterRevision)
      throw new SchoolUnavailable();
    const member =
      session.view.hostId === subject.id ||
      session.view.playerIds.includes(subject.id);
    if (!observing && session.view.status === "paused" && !member) {
      // Public presence is also paused while an empty/recovering worker starts.
      // Only a deliberate pause restricts admission to the existing roster.
      const policy = await this.row(
        this.client.rpc("voxel_session_policy", { p_session: request.room }),
      );
      if (
        !record(policy) ||
        !["playing", "paused", "ended"].includes(policy.state as string)
      )
        throw new SchoolUnavailable();
      if (policy.state === "ended") deny("SESSION_ENDED");
      if (policy.state === "paused") deny("PAUSED_ROSTER");
    }
    if (
      !observing &&
      !session.view.isOpen &&
      !member &&
      (!request.invitationCode ||
        request.invitationCode !== session.invitationCode)
    ) {
      const accepted = await this.row(
        this.client
          .from("game_challenges")
          .select("id")
          .eq("session_id", request.room)
          .eq("to_kid_id", subject.id)
          .eq("status", "accepted")
          .maybeSingle(),
      );
      if (accepted === null) deny("SESSION_CLOSED");
      if (!record(accepted) || !uuid(accepted.id))
        throw new SchoolUnavailable();
    }
    const schedule =
      subject.role === "kid" && checkRecess ? await this.recess(subject) : null;
    const now = this.now();
    if (
      !Number.isFinite(now) ||
      now < started ||
      now >= started + AUTHORIZATION_MS ||
      tokenExpiresAt <= now
    )
      throw new SchoolUnavailable();
    if (
      schedule &&
      !isWithinEffectiveRecess(new Date(now), {
        defaultWindows: schedule.defaults,
        classSchedule: {
          overrideEnabled: schedule.setting,
          exceptions: schedule.exceptions,
        },
      })
    )
      deny("RECESS_CLOSED");
    let expiresAt = Math.min(started + AUTHORIZATION_MS, tokenExpiresAt);
    const nextMinute = now + (60000 - (now % 60000));
    if (
      schedule &&
      nextMinute < expiresAt &&
      !isWithinEffectiveRecess(new Date(nextMinute), {
        defaultWindows: schedule.defaults,
        classSchedule: {
          overrideEnabled: schedule.setting,
          exceptions: schedule.exceptions,
        },
      })
    )
      expiresAt = nextMinute;
    const role = observing ? "observer" : "participant";
    const actor = Object.freeze({
      id: subject.id,
      role,
      capabilities: Object.freeze({
        build: !observing,
        fly: true,
        observe: observing,
        combat: !observing,
        explosives: !observing,
      }),
    }) as AdmittedActor;
    return Object.freeze({
      actor,
      subject,
      session: session.view,
      controls:
        staff ||
        (session.view.hostId === subject.id &&
          policy.revision <= policy.acceptedRevision),
      policy,
      expiresAt,
    });
  }
  /** Session-wide status is separate from individual partition/recess admission. */
  async roomPolicy(room: string): Promise<RoomPolicy> {
    if (!uuid(room)) deny("INVALID");
    const started = this.now();
    let state: RoomPolicy["state"];
    try {
      const session = await this.session(room);
      state = session.view.status === "paused" ? "paused" : "playing";
    } catch (error) {
      if (!(error instanceof AccessDenied)) throw error;
      if (!["NOT_FOUND", "WRONG_GAME", "SESSION_ENDED"].includes(error.code))
        throw error;
      state = "ended";
    }
    const now = this.now();
    if (
      !Number.isFinite(now) ||
      now < started ||
      now >= started + AUTHORIZATION_MS
    )
      throw new SchoolUnavailable();
    return Object.freeze({ state, expiresAt: started + AUTHORIZATION_MS });
  }
  /** Passive owned objects require fresh eligibility; room lifecycle handles recess pauses. */
  async resolveOwner(room: string, id: string): Promise<AdmittedActor | null> {
    try {
      const started = this.now(),
        subject = await this.profile(id);
      if (!subject) return null;
      const checked = await this.evaluate(
        subject,
        checkedInput({ room, participation: "player" }),
        started,
        Number.MAX_SAFE_INTEGER,
        false,
      );
      return checked.session.playerIds.includes(id) &&
        checked.policy.revision <= checked.policy.acceptedRevision
        ? checked.actor
        : null;
    } catch (error) {
      if (error instanceof AccessDenied) return null;
      throw error;
    }
  }
}

export function bearerToken(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 16400) return null;
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/i.exec(value.trim());
  return match?.[1] ?? null;
}
