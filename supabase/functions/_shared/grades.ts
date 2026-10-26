export const CLASS_GRADES = ["גן", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"] as const;
export type ClassGrade = typeof CLASS_GRADES[number];

export function parseImportGrade(value: unknown): ClassGrade | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const clean = String(value).trim().replace(/^כיתה\s+/, "").replace(/['"׳״]+$/, "").trim();
  if (CLASS_GRADES.includes(clean as ClassGrade)) return clean as ClassGrade;
  if (/^[0-9]$/.test(clean)) return CLASS_GRADES[Number(clean)];
  return null;
}
