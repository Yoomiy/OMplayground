import { supabase } from "@/lib/supabase";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type SoloSaveKind = "snapshot" | "checkpoint";

export interface SoloGameSave {
  kid_id: string;
  game_key: string;
  state: JsonValue;
  state_version: number;
  save_kind: SoloSaveKind;
  updated_at: string;
}

export interface UpsertSoloGameSaveInput {
  kidId: string;
  gameKey: string;
  state: JsonValue;
  stateVersion?: number;
  saveKind?: SoloSaveKind;
}

export interface SoloGameSaveControls {
  savedState: JsonValue | null;
  saveState: (
    state: JsonValue,
    options?: { stateVersion?: number; saveKind?: SoloSaveKind }
  ) => Promise<void>;
  clearSave: () => Promise<void>;
  mergeBestScores: (
    updates: Record<string, number>,
    preferLowerKeys?: string[]
  ) => Promise<void>;
}

export function isJsonObject(value: JsonValue | undefined): value is {
  [key: string]: JsonValue;
} {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function listSoloGameSaves(kidId: string | undefined) {
  if (!kidId) return [];
  const { data, error } = await supabase
    .from("solo_game_saves")
    .select("kid_id, game_key, state, state_version, save_kind, updated_at")
    .eq("kid_id", kidId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SoloGameSave[];
}

export async function getSoloGameSave(
  kidId: string | undefined,
  gameKey: string | undefined
) {
  if (!kidId || !gameKey) return null;
  const { data, error } = await supabase
    .from("solo_game_saves")
    .select("kid_id, game_key, state, state_version, save_kind, updated_at")
    .eq("kid_id", kidId)
    .eq("game_key", gameKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as SoloGameSave | null;
}

export async function upsertSoloGameSave({
  kidId,
  gameKey,
  state,
  stateVersion = 1,
  saveKind = "snapshot"
}: UpsertSoloGameSaveInput) {
  const { data, error } = await supabase
    .from("solo_game_saves")
    .upsert(
      {
        kid_id: kidId,
        game_key: gameKey,
        state,
        state_version: stateVersion,
        save_kind: saveKind
      },
      { onConflict: "kid_id,game_key" }
    )
    .select("kid_id, game_key, state, state_version, save_kind, updated_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as SoloGameSave | null;
}

export async function deleteSoloGameSave(
  kidId: string | undefined,
  gameKey: string | undefined
) {
  if (!kidId || !gameKey) return;
  const { error } = await supabase
    .from("solo_game_saves")
    .delete()
    .eq("kid_id", kidId)
    .eq("game_key", gameKey);
  if (error) throw new Error(error.message);
}

export async function mergeBestScores(
  kidId: string,
  updates: Record<string, number>,
  preferLowerKeys: string[] = []
) {
  const { data, error } = await supabase
    .from("kid_profiles")
    .select("best_scores")
    .eq("id", kidId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const current = ((data?.best_scores ?? {}) as Record<string, number>) ?? {};
  const preferLower = new Set(preferLowerKeys);
  const next = { ...current };
  let changed = false;

  for (const [key, value] of Object.entries(updates)) {
    const old = next[key];
    const shouldUpdate =
      typeof old !== "number" ||
      (preferLower.has(key) ? value < old : value > old);
    if (Number.isFinite(value) && shouldUpdate) {
      next[key] = value;
      changed = true;
    }
  }

  if (!changed) return current;

  const { error: updateError } = await supabase
    .from("kid_profiles")
    .update({ best_scores: next })
    .eq("id", kidId);
  if (updateError) throw new Error(updateError.message);
  return next;
}
