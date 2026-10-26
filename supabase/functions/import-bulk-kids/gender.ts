export function parseImportGender(value: unknown): "boy" | "girl" | null {
  if (typeof value !== "string") return null;
  switch (value.trim().toLowerCase()) {
    case "boy":
    case "male":
    case "m":
    case "בן":
    case "זכר":
      return "boy";
    case "girl":
    case "female":
    case "f":
    case "בת":
    case "נקבה":
      return "girl";
    default:
      return null;
  }
}
