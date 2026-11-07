export interface RematchClosure {
  reason: string;
  userId?: string;
}
export function rematchEndMessage(closed: RematchClosure): string {
  if (closed.reason === "left") return "המשחק הסתיים. שחקן יצא מהחדר ולכן לא יתקיים משחק חוזר.";
  if (closed.reason === "declined") return "המשחק הסתיים. ההזמנה למשחק חוזר נדחתה.";
  return "המשחק הסתיים. לא התקבלו מספיק אישורים למשחק חוזר.";
}
