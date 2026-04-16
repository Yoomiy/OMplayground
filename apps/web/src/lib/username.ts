/** Maps a kid-visible username to the synthetic Auth email (never shown in UI). */
export function usernameToSyntheticEmail(username: string): string {
  const safe = username.trim().toLowerCase();
  return `${safe}@playground.school.local`;
}
