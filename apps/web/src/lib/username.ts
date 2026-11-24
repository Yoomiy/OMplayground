const syntheticEmailSuffix = "@playground.school.local";

/** Maps a kid-visible username to the synthetic Auth email (never shown in UI). */
export function usernameToSyntheticEmail(username: string): string {
  const safe = username.trim().toLowerCase();
  return `${safe}${syntheticEmailSuffix}`;
}

export function syntheticEmailToUsername(email?: string): string {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized.endsWith(syntheticEmailSuffix)
    ? normalized.slice(0, -syntheticEmailSuffix.length)
    : "";
}
