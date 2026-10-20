import { AdmissionError, enforceAdmission, type Admission, type PlatformProfile, type PlatformSession } from './admission.js';
import { isWithinEffectiveRecess, type RecessWindow, type ClassRecessException } from './recess-schedule.js';
import { platformLog } from './logging.js';
import { randomUUID } from 'node:crypto';

/** Supabase REST boundary. Service credentials never enter a client/launch ticket. */
export class PlatformGateway {
  private schedules: { at: number; defaults: RecessWindow[]; settings: { grade: string; gender: string; override_enabled: boolean }[];
    exceptions: (ClassRecessException & { grade: string; gender: string })[] } | null = null;
  constructor(private readonly url: string, private readonly key: string, private readonly request: typeof fetch = fetch) {
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  private async rest<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await this.request(`${this.url.replace(/\/$/, '')}/rest/v1/${path}`, {
        ...init, signal: AbortSignal.timeout(8000), headers: {
          apikey: this.key, Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json',
          Prefer: 'return=representation', ...init.headers,
        },
      });
    } catch {
      platformLog('error', 'ROCKET_DATABASE_REQUEST_FAILED', { resource: path.split('?')[0], method: init.method ?? 'GET', status: 'unreachable' });
      throw new AdmissionError('PLATFORM_UNAVAILABLE', 503);
    }
    if (!response.ok) {
      const detail = await response.json().catch(() => null) as { code?: unknown } | null;
      platformLog('error', 'ROCKET_DATABASE_REQUEST_FAILED', { resource: path.split('?')[0], method: init.method ?? 'GET',
        status: response.status, databaseCode: typeof detail?.code === 'string' && /^[A-Z0-9_]{1,64}$/i.test(detail.code) ? detail.code : undefined });
      throw new AdmissionError('PLATFORM_UNAVAILABLE', 503);
    }
    return await response.json() as T;
  }

  async authenticate(token: unknown): Promise<PlatformProfile> {
    if (typeof token !== 'string' || token.length < 10 || token.length > 8192) throw new AdmissionError('UNAUTHORIZED', 401);
    let response: Response;
    try {
      response = await this.request(`${this.url.replace(/\/$/, '')}/auth/v1/user`, {
        headers: { apikey: this.key, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000),
      });
    } catch { throw new AdmissionError('PLATFORM_UNAVAILABLE', 503); }
    if (!response.ok) throw new AdmissionError('UNAUTHORIZED', 401);
    const user = await response.json() as { id?: unknown };
    if (typeof user.id !== 'string') throw new AdmissionError('UNAUTHORIZED', 401);
    return this.profile(user.id);
  }

  async profile(userId: string): Promise<PlatformProfile> {
    const id = encodeURIComponent(userId);
    const profiles = await this.rest<{ id: string; role: string; gender: string; grade: string | null; full_name: string; is_active: boolean }[]>(
      `kid_profiles?id=eq.${id}&select=id,role,gender,grade,full_name,is_active`);
    const profile = profiles[0];
    if (profile?.is_active && (profile.role === 'kid' || profile.role === 'teacher') && ['boy', 'girl'].includes(profile.gender)) {
      return { userId, role: profile.role, gender: profile.gender, grade: profile.grade, name: profile.full_name.slice(0, 80) };
    }
    const admins = await this.rest<{ full_name: string }[]>(`admin_profiles?id=eq.${id}&select=full_name`);
    if (admins[0]) return { userId, role: 'admin', gender: '', grade: null, name: (admins[0].full_name || 'מנהל').slice(0, 80) };
    throw new AdmissionError('PROFILE_DISABLED');
  }

  async session(sessionId: string): Promise<PlatformSession> {
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new AdmissionError('BAD_SESSION', 400);
    const rows = await this.rest<PlatformSession[]>(`game_sessions?id=eq.${sessionId}&select=id,host_id,gender,status,is_open,invitation_code,player_ids,player_names,connected_player_ids,connected_player_names,last_activity,game_state,peak_player_count,games(game_url,is_active)`);
    if (!rows[0]) throw new AdmissionError('SESSION_NOT_FOUND', 404);
    return rows[0];
  }

  /** Keyset pagination also reaches expired owners beyond PostgREST's row cap. */
  async expiredAllocations(now: number, afterId?: string): Promise<PlatformSession[]> {
    const query = new URLSearchParams({
      select: 'id,host_id,status,is_open,invitation_code,gender,player_ids,player_names,connected_player_ids,connected_player_names,last_activity,game_state',
      status: 'in.(waiting,playing,paused)', 'game_state->>rocket': 'eq.true',
      and: `(game_state->leaseUntil.gt.0,game_state->leaseUntil.lte.${now})`,
      order: 'id.asc', limit: '100', ...(afterId ? { id: `gt.${afterId}` } : {}),
    });
    return this.rest<PlatformSession[]>(`game_sessions?${query}`);
  }

  async admit(profile: PlatformProfile, sessionId: string, observer: boolean, invitationCode?: string): Promise<Admission> {
    const session = await this.session(sessionId);
    let challenged = false;
    if (!observer && !session.is_open && !session.player_ids.includes(profile.userId) && invitationCode !== session.invitation_code) {
      const rows = await this.rest<unknown[]>(`game_challenges?session_id=eq.${sessionId}&to_kid_id=eq.${encodeURIComponent(profile.userId)}&status=eq.accepted&select=id&limit=1`);
      challenged = rows.length > 0;
    }
    return enforceAdmission({ profile, session, observer, invitationCode, challenged,
      withinRecess: profile.role !== 'kid' || await this.withinRecess(profile) });
  }

  async withinRecess(profile: PlatformProfile): Promise<boolean> {
    if (!profile.grade) return false;
    if (!this.schedules || Date.now() - this.schedules.at > 15_000) {
      const [defaults, settings, exceptions] = await Promise.all([
        this.rest<RecessWindow[]>('recess_schedules?is_active=eq.true&select=day_of_week,start_time,end_time,is_active'),
        this.rest<NonNullable<typeof this.schedules>['settings']>('class_recess_schedule_settings?select=grade,gender,override_enabled'),
        this.rest<NonNullable<typeof this.schedules>['exceptions']>('class_recess_schedule_exceptions?is_active=eq.true&select=grade,gender,day_of_week,start_time,end_time,mode,is_active'),
      ]);
      this.schedules = { at: Date.now(), defaults, settings, exceptions };
    }
    const { defaults, settings, exceptions } = this.schedules;
    const setting = settings.find(row => row.grade === profile.grade && row.gender === profile.gender);
    return isWithinEffectiveRecess(new Date(), { defaultWindows: defaults, classSchedule: setting ? {
      overrideEnabled: setting.override_enabled, exceptions: exceptions.filter(row => row.grade === profile.grade && row.gender === profile.gender),
    } : null });
  }

  /** Only an existing participant may consent to a new round of an ended match. */
  async admitRematch(profile: PlatformProfile, sessionId: string, observer: boolean): Promise<Admission> {
    const session = await this.session(sessionId);
    if (session.status !== 'completed') throw new AdmissionError('SESSION_CHANGED', 409);
    if (!observer && !session.player_ids.includes(profile.userId)) throw new AdmissionError('NOT_IN_ROSTER');
    const fresh = enforceAdmission({ profile, session: { ...session, status: 'waiting' }, observer,
      challenged: false, withinRecess: profile.role !== 'kid' || await this.withinRecess(profile) });
    return { ...fresh, session };
  }

  async audit(admission: Admission, action: string, targetUserId?: string): Promise<void> {
    await this.rest('audit_log', { method: 'POST', body: JSON.stringify({
      actor_id: admission.profile.userId, actor_kind: admission.profile.role,
      action: `rocket_${action}`, entity_type: 'game_session', entity_id: admission.session.id,
      metadata: { correlation_id: admission.correlationId, outcome: 'requested', ...(targetUserId ? { target_user_id: targetUserId } : {}) },
    }) });
  }

  async sendChat(admission: Admission, message: unknown): Promise<void> {
    if (admission.observer) throw new AdmissionError('READ_ONLY');
    if (typeof message !== 'string' || !message.trim() || message.length > 500) throw new AdmissionError('BAD_MESSAGE', 400);
    await this.rest('chat_messages', { method: 'POST', body: JSON.stringify({
      session_id: admission.session.id, sender_id: admission.profile.userId,
      sender_name: admission.profile.name, message: message.trim(), is_system: false,
    }) });
  }

  /** Bound the URL size when checkpoints grow; preserve CAS on metadata and roster. */
  async update(session: PlatformSession, patch: Record<string, unknown>): Promise<void> {
    const query = new URLSearchParams({ id: `eq.${session.id}`, status: `eq.${session.status}`,
      player_ids: `eq.{${session.player_ids.join(',')}}` });
    if (typeof session.game_state?.revision === 'string') query.set('game_state->>revision', `eq.${session.game_state.revision}`);
    else query.set('game_state', session.game_state === null ? 'is.null' : `eq.${JSON.stringify(session.game_state)}`);
    if (patch.game_state && typeof patch.game_state === 'object') {
      patch = { ...patch, game_state: { ...patch.game_state, revision: randomUUID() } };
    }
    const changed = await this.rest<PlatformSession[]>(`game_sessions?${query}`, { method: 'PATCH', body: JSON.stringify(patch) });
    if (changed.length !== 1) throw new AdmissionError('SESSION_CHANGED', 409);
  }
}
