/** Hebrew display copy only. Course IDs, simulation data and input axes stay unchanged. */
import type { CourseDefinition } from "../shared/types"

const COURSE_COPY: Readonly<Record<string, readonly [string, string]>> = {
  "sunrise-scramble": ["מרוץ הזריחה", "מסלול שמשי עם מוטות מסתובבים, איים ומקפצות."],
  "sky-hop": ["קפיצות בשמיים", "איים צפים, מעבורות וטיפוס אל העננים."],
  "bumper-boulevard": ["שדרת המקפצות", "סלאלום צבעוני בין מקפצות ופניות."],
  "clockwork-crossing": ["צומת השעונים", "שערים ומסועים במפעל צבעוני."],
  "ribbon-ridge": ["רכס הסרטים", "גשרים מפותלים ואיים מעל הקניון."],
  "festival-finale": ["חגיגת הסיום", "מצעד של קפיצות, שערים, מסועים ומוטות מסתובבים."],
  "cloudline-fork": ["פיצול בעננים", "גשרים גבוהים ודרכים מתפתלות בין העננים."],
  "canopy-switch": ["פניות בצמרות", "מסלולים מצטלבים ופניות חדות ביער."],
  "twin-turbo": ["טורבו כפול", "רצועות האצה, פניות חדות ודרכים מקבילות."],
  "switchyard-shuffle": ["צומת המסילות", "חצר מסילות מצטלבת, מעבורות ושערים."],
  "sugar-skyways": ["שבילי הסוכר", "איי ממתקים ודרכים מצטלבות בשמיים."],
  "canyon-choices": ["שבילי הקניון", "גשרים גבוהים ופניות מפותלות בין צוקי הקניון."],
  "triple-junction": ["הצומת המשולש", "שלוש דרכים נפגשות במסלול צבעוני."],
  "harbor-hoppers": ["קפיצות בנמל", "רציפים, מעבורות ומעליות לאורך החוף."],
  "terrace-tangle": ["סבך המרפסות", "דרכים שזורות זו מעל זו, עם מעברים בין הגבהים."],
  "finale-freeways": ["כבישי החגיגה", "לולאות, שערים וצמתים גבוהים בחגיגה גדולה."],
  "spiral-summit": ["הפסגה הספירלית", "טיפוס מסוחרר בין שבילי האצה, שערים ומעלית."],
  "vault-or-wait": ["לקפוץ או לחכות", "איים, שערים ומסלולים בקצבים שונים."],
  "tidal-twist": ["פיתולי הגאות", "זרמים מנוגדים, מסועים ופניות חדות."],
  "lift-lock": ["מעליות בשמיים", "מעליות ודרכים מתעקלות בגבהים שונים."],
  "shutter-shuttle": ["מסע בין שערים", "מסועים, שערים מחזוריים ולולאות האצה."],
  "sky-transfer": ["מעבר בשחקים", "מעלית, מעבורת ואיים גבוהים בין העננים."],
  "pendulum-pier": ["רציף המטוטלת", "מעבורת מהירה, קפיצות ומסועים לאורך המזח."],
}
export const courseName = (course: CourseDefinition): string =>
  COURSE_COPY[course.id]?.[0] ?? course.name
export const courseDescription = (course: CourseDefinition): string =>
  COURSE_COPY[course.id]?.[1] ?? course.description ?? ""
export const difficultyName = (difficulty: CourseDefinition["difficulty"]): string =>
  difficulty === "Tricky" ? "מאתגר" : difficulty === "Medium" ? "בינוני" : "קל"
/** Unicode isolates keep arbitrary names/codes intact inside Hebrew plain text. */
export const isolate = (text: string | number): string => `\u2068${text}\u2069`
