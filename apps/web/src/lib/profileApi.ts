import { supabase } from "@/lib/supabase";
import type { KidProfileRow } from "@/hooks/useProfile";
import type { PublicKidProfile } from "@/hooks/useOnlineKids";

export const AVATAR_BUCKET = "avatars";
export const AVATAR_MAX_BYTES = 512 * 1024;
export const AVATAR_MAX_DIMENSION = 512;

export interface AvatarPreset {
  id: string;
  key: string;
  label_he: string;
  emoji: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface PublicProfile extends PublicKidProfile {
  grade: number;
  last_seen: string | null;
  created_at: string;
}

export type MyProfileUpdates = Partial<
  Pick<KidProfileRow, "full_name" | "avatar_color" | "avatar_preset_id" | "avatar_url">
>;

export type AdminProfileUpdates = Partial<
  Pick<
    KidProfileRow,
    | "username"
    | "full_name"
    | "gender"
    | "grade"
    | "role"
    | "is_active"
    | "avatar_color"
    | "avatar_preset_id"
    | "avatar_url"
    | "best_scores"
    | "unread_message_count"
  >
>;

export async function fetchAvatarPresets(includeInactive = false) {
  let query = supabase
    .from("avatar_presets")
    .select("id, key, label_he, emoji, image_url, is_active, sort_order")
    .order("sort_order", { ascending: true })
    .order("label_he", { ascending: true });
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AvatarPreset[];
}

export async function fetchPublicProfile(kidId: string) {
  const { data, error } = await supabase
    .from("public_kid_profiles")
    .select(
      "id, username, full_name, gender, grade, role, avatar_color, avatar_preset_id, avatar_url, last_seen, created_at"
    )
    .eq("id", kidId)
    .eq("role", "kid")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as PublicProfile | null;
}

export async function updateMyProfile(updates: MyProfileUpdates) {
  const { data, error } = await supabase.rpc("update_my_profile", {
    p_updates: updates
  });
  if (error) throw new Error(error.message);
  return data as KidProfileRow;
}

export async function adminUpdateKidProfile(
  kidId: string,
  updates: AdminProfileUpdates
) {
  const { data, error } = await supabase.rpc("admin_update_kid_profile", {
    p_kid_id: kidId,
    p_updates: updates
  });
  if (error) throw new Error(error.message);
  return data as KidProfileRow;
}

export async function uploadAvatar(userId: string, file: File) {
  const compressed = await compressAvatarImage(file);
  const ext = compressed.type === "image/png" ? "png" : compressed.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, compressed, {
      contentType: compressed.type,
      upsert: false
    });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function compressAvatarImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("יש לבחור קובץ תמונה");
  }

  const source = await loadImage(file);
  const scale = Math.min(
    1,
    AVATAR_MAX_DIMENSION / Math.max(source.width, source.height)
  );
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("לא ניתן לעבד את התמונה");
  ctx.drawImage(source, 0, 0, width, height);

  for (const quality of [0.86, 0.76, 0.66, 0.56, 0.46]) {
    const blob = await canvasToBlob(canvas, "image/webp", quality);
    if (blob.size <= AVATAR_MAX_BYTES) return blob;
  }

  const fallback = await canvasToBlob(canvas, "image/jpeg", 0.42);
  if (fallback.size <= AVATAR_MAX_BYTES) return fallback;
  throw new Error("התמונה גדולה מדי גם אחרי דחיסה. נסה תמונה קטנה יותר.");
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("לא ניתן לקרוא את התמונה"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("דחיסת התמונה נכשלה"));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}
