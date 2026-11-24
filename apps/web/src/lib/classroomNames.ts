const guestNameKey = "classroom-display-name";
const accountNameKey = "classroom-account-name";

export type ClassroomAccountName = {
  userId: string;
  username: string;
  displayName: string;
};

function normalizeName(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

export function readClassroomAccountName(): ClassroomAccountName | null {
  try {
    const saved = JSON.parse(window.localStorage.getItem(accountNameKey) ?? "null");
    if (typeof saved?.userId !== "string" || !saved.userId) return null;
    return {
      userId: saved.userId,
      username: normalizeName(saved.username),
      displayName: normalizeName(saved.displayName),
    };
  } catch {
    return null;
  }
}

export function readClassroomGuestName(): string {
  try {
    return normalizeName(window.localStorage.getItem(guestNameKey));
  } catch {
    return "";
  }
}

export function rememberClassroomAccountName(account: ClassroomAccountName): void {
  try {
    window.localStorage.setItem(accountNameKey, JSON.stringify(account));
  } catch {}
}

export function rememberClassroomGuestName(name: string): void {
  try {
    window.localStorage.setItem(guestNameKey, normalizeName(name));
  } catch {}
}
