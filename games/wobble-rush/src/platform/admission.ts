export class AdmissionError extends Error {
  constructor(
    readonly code: string,
    readonly status = 403,
  ) {
    super(code)
  }
}

export interface PlatformProfile {
  userId: string
  role: "kid" | "teacher" | "admin"
  name: string
  gender: string
  grade: string | null
}

export interface PlatformSession {
  id: string
  host_id: string
  gender: string
  status: string
  is_open: boolean
  invitation_code: string | null
  player_ids: string[]
  player_names: string[]
  game_state: Record<string, unknown> | null
  peak_player_count?: number
  last_activity?: string
  connected_player_ids?: string[]
  connected_player_names?: string[]
  games: { game_url: string; is_active: boolean; min_players?: number; max_players?: number }
  connected_observer_ids?: string[]
  host_name?: string
  host_grade?: string | null
}

export interface Admission {
  correlationId?: string | undefined
  profile: PlatformProfile
  session: PlatformSession
  observer: boolean
}

export function enforceAdmission(args: {
  profile: PlatformProfile
  session: PlatformSession
  observer: boolean
  invitationCode?: string | undefined
  challenged: boolean
  withinRecess: boolean
}): Admission {
  const { profile, session } = args
  const staff = profile.role === "teacher" || profile.role === "admin"
  const observer = staff && args.observer
  if (args.observer && !staff) throw new AdmissionError("OBSERVER_FORBIDDEN")
  if (session.games?.game_url !== "wobble-rush" || !session.games.is_active)
    throw new AdmissionError("GAME_UNAVAILABLE")
  if (session.status === "completed") throw new AdmissionError("SESSION_COMPLETED", 409)
  if (!["waiting", "playing", "paused"].includes(session.status))
    throw new AdmissionError("SESSION_UNAVAILABLE", 409)
  if (!observer && profile.gender !== session.gender) throw new AdmissionError("GENDER_MISMATCH")
  if (profile.role === "kid" && !args.withinRecess) throw new AdmissionError("RECESS_DENIED")
  const represented =
    session.player_ids.includes(profile.userId) || session.host_id === profile.userId
  const invited = !!args.invitationCode && args.invitationCode === session.invitation_code
  if (!observer && !session.is_open && !represented && !invited && !args.challenged)
    throw new AdmissionError("SESSION_CLOSED")
  if (!observer && session.status === "paused" && !represented)
    throw new AdmissionError("NOT_IN_ROSTER")
  return { profile, session, observer }
}
