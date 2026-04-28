import { cn } from "@/lib/cn";
import type { AvatarPreset } from "@/lib/profileApi";

const BUILT_IN_PRESETS: Pick<AvatarPreset, "key" | "emoji">[] = [
  { key: "fox", emoji: "🦊" },
  { key: "robot", emoji: "🤖" },
  { key: "cat", emoji: "🐱" },
  { key: "unicorn", emoji: "🦄" },
  { key: "lion", emoji: "🦁" },
  { key: "penguin", emoji: "🐧" },
  { key: "dragon", emoji: "🐉" },
  { key: "owl", emoji: "🦉" },
  { key: "bear", emoji: "🐻" },
  { key: "rabbit", emoji: "🐰" },
  { key: "shark", emoji: "🦈" },
  { key: "dinosaur", emoji: "🦖" }
];

export interface KidAvatarProfile {
  full_name: string;
  avatar_color: string;
  avatar_preset_id: string | null;
  avatar_url: string | null;
}

export interface KidAvatarProps {
  profile: KidAvatarProfile;
  presets?: AvatarPreset[];
  className?: string;
  textClassName?: string;
}

export function KidAvatar({
  profile,
  presets = [],
  className,
  textClassName
}: KidAvatarProps) {
  const preset = profile.avatar_preset_id
    ? presets.find((p) => p.key === profile.avatar_preset_id)
    : null;
  const builtIn = profile.avatar_preset_id
    ? BUILT_IN_PRESETS.find((p) => p.key === profile.avatar_preset_id)
    : null;
  const label = `אווטאר של ${profile.full_name}`;
  const fallback = profile.full_name.trim().slice(0, 1) || "?";

  if (profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={label}
        className={cn(
          "size-12 min-h-[48px] min-w-[48px] rounded-2xl object-cover shadow-md",
          className
        )}
      />
    );
  }

  if (preset?.image_url) {
    return (
      <img
        src={preset.image_url}
        alt={label}
        className={cn(
          "size-12 min-h-[48px] min-w-[48px] rounded-2xl object-cover shadow-md",
          className
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex size-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl text-lg font-bold text-white shadow-md",
        className
      )}
      style={{ backgroundColor: profile.avatar_color }}
      aria-label={label}
      role="img"
    >
      <span className={textClassName}>{preset?.emoji ?? builtIn?.emoji ?? fallback}</span>
    </span>
  );
}
