import { useState } from "react";
import type { ItemDefinition } from "../../../../../games/voxel/src/shared/content";
import { describeItem } from "../../../../../games/voxel/src/client/item-description";

const tabs = [
  ["controls", "מקשים"],
  ["crafting", "יצירה"],
  ["tools", "כלים"],
  ["building", "בנייה"],
  ["food", "אוכל"],
  ["gear", "ציוד"],
] as const;

/** The familiar guide topics, with instructions and values from the current game. */
export function VoxelHelp({
  open,
  items,
  labels,
  onClose,
  onInventory,
  canUseInventory,
}: {
  open: boolean;
  items: readonly ItemDefinition[];
  labels: Readonly<Record<string, string>>;
  onClose: () => void;
  onInventory: () => void;
  canUseInventory: boolean;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("controls");
  if (!open) return null;
  const name = (item: ItemDefinition) => labels[item.itemType] ?? item.labelKey;
  return (
    <aside className="voxel-session__help" aria-label="מדריך המשחק">
      <header>
        <div>
          <h2>מדריך המשחק</h2>
          <p>מקשים, יצירה והצעדים הראשונים</p>
        </div>
        <button type="button" onClick={onClose} aria-label="סגירת העזרה">
          ✕ סגירה (H)
        </button>
      </header>
      <nav aria-label="נושאי עזרה">
        {tabs.map(([id, title]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {title}
          </button>
        ))}
      </nav>
      <div className="voxel-session__help-content">
        {tab === "controls" && (
          <>
            <section>
              <h3>תנועה ומצלמה</h3>
              <dl>
                <dt>WASD / חיצים</dt>
                <dd>תנועה בעולם</dd>
                <dt>רווח</dt>
                <dd>קפיצה</dd>
                <dt>Ctrl</dt>
                <dd>ריצה כשיש מספיק מזון</dd>
                <dt>Shift</dt>
                <dd>התגנבות; בנייה ליד תיבה או שולחן בלי לפתוח אותם</dd>
                <dt>V / גלגלת</dt>
                <dd>מבט ראשון או שלישי וקירוב המצלמה</dd>
                <dt>F</dt>
                <dd>תעופה במצב יצירתי או בתצפית; רווח לעלייה ו־Shift לירידה</dd>
              </dl>
            </section>
            <section>
              <h3>פעולות</h3>
              <dl>
                <dt>שמאלי</dt>
                <dd>כרייה (החזק), או תקיפת שחקן מכוון כשקרבות מופעלים</dd>
                <dt>ימני</dt>
                <dd>הנחת בלוק, פתיחת שולחן יצירה או תיבה, ושימוש בדלי</dd>
                <dt>1–9</dt>
                <dd>בחירת משבצת בסרגל המהיר</dd>
                <dt>אמצעי</dt>
                <dd>בחירת בלוק מהעולם</dd>
                <dt>E</dt>
                <dd>פתיחה וסגירה של המלאי</dd>
                <dt>Q / X</dt>
                <dd>השלכת פריט אחד / תקיפה</dd>
                <dt>R / G</dt>
                <dd>אכילה / הצתת TNT עם כלי מתאים</dd>
                <dt>T / Enter</dt>
                <dd>פתיחת הצ׳אט</dd>
                <dt>H / Esc</dt>
                <dd>מדריך המשחק / שחרור העכבר</dd>
              </dl>
            </section>
            <section>
              <h3>חזרה למשחק</h3>
              <p>
                העולם נפתח אוטומטית. לחיצה במסך המשחק לוכדת את העכבר למבט חופשי.
                פתיחת מלאי, צ׳אט ועזרה עוצרת רק את השליטה שלכם; המפגש ממשיך.
              </p>
            </section>
          </>
        )}
        {tab === "crafting" && (
          <>
            <section>
              <h3>התחלה: מעץ לשולחן יצירה</h3>
              <ol>
                <li>אספו גזע עץ ופתחו מלאי עם E.</li>
                <li>
                  שימו גזע אחד ברשת 2×2 ולחצו על התוצר: מקבלים ארבעה לוחות.
                </li>
                <li>
                  בחרו את ערימת הלוחות, ואז לחצו ימנית פעם אחת בכל אחת מארבע
                  המשבצות. השאר נשארים ביד.
                </li>
                <li>
                  לחצו על השולחן שמופיע במשבצת התוצר. הניחו אותו בעולם ולחצו
                  עליו ימנית כדי לפתוח רשת 3×3.
                </li>
              </ol>
            </section>
            <section>
              <h3>ספר המתכונים</h3>
              <p>
                הספר נמצא ליד רשת היצירה. ״אפשר ליצור״ מציג מתכונים שיש לכם
                חומרים עבורם; שאר הלשוניות מחלקות כלים וציוד, בנייה, אוכל
                וחומרים. אפשר גם לחפש בשם.
              </p>
              <p>
                ״סידור ברשת״ מכין את המרכיבים במקומות הנכונים. יצירת הפריט
                מתבצעת רק כשלוחצים על התוצר. מתכוני 3×3 דורשים שולחן.
              </p>
            </section>
            <section>
              <h3>העברת ערימות</h3>
              <p>
                לחיצה בוחרת ערימה. לחיצה ימנית על המקור בוחרת חצי; לחיצה ימנית
                על יעד מניחה פריט אחד. לחיצה רגילה על יעד מניחה את כל מה שביד.
                לחיצה על המקור מחזירה את הבחירה. אפשר לגרור, ו־Shift ולחיצה
                מעבירים במהירות בין התיק, הסרגל והתיבה.
              </p>
            </section>
            <button
              type="button"
              disabled={!canUseInventory}
              onClick={onInventory}
            >
              פתיחת המלאי וספר המתכונים
            </button>
          </>
        )}
        {tab === "tools" && (
          <>
            <section>
              <h3>בחירת כלי</h3>
              <p>
                שימו כלי בסרגל המהיר ובחרו אותו עם 1–9. מכוש מיועד לאבן ולעפרות,
                גרזן לעץ ואת לעפר ולחול. בלוקים מסוימים דורשים כלי בדרגה מתאימה.
                הקו מתחת לכלי מראה כמה עמידות נשארה.
              </p>
              <p>
                במצב יצירתי אפשר לבחור בלוקים מהקטלוג. כדי להחזיק כלי, הוסיפו
                אותו למלאי, העבירו לסרגל ובחרו ״החזקה מהתיק״.
              </p>
            </section>
            <section>
              <h3>הכלים במשחק</h3>
              <table>
                <thead>
                  <tr>
                    <th>כלי</th>
                    <th>דרגה</th>
                    <th>מהירות כרייה</th>
                  </tr>
                </thead>
                <tbody>
                  {items
                    .filter((item) => item.tool)
                    .map((item) => (
                      <tr key={item.itemType}>
                        <td>{name(item)}</td>
                        <td>{item.tool!.tier}</td>
                        <td>×{item.tool!.speed}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
          </>
        )}
        {tab === "building" && (
          <>
            <section>
              <h3>בנייה ואחסון</h3>
              <p>
                בחרו בלוק בסרגל והניחו בלחיצה ימנית על פאה של בלוק קרוב. לחיצה
                אמצעית בוחרת בלוק מכוון; בהישרדות נדרש שיהיה בסרגל שלכם.
              </p>
              <p>
                לחיצה ימנית על תיבה פותחת אחסון משותף; לחיצה ימנית על שולחן
                פותחת יצירה 3×3. החזיקו Shift כדי להניח לידם בלוק. תיבה מלאה
                צריך לרוקן לפני ששוברים אותה.
              </p>
            </section>
            <section>
              <h3>צמחים, תאורה ודליים</h3>
              <p>
                צמחים נשברים מיד. בלוקים רגילים מראים סדקים בזמן הכרייה. לפידים
                מאירים; צמחים וסולמות דורשים משטח מתאים. דלי ריק אוסף מים בלחיצה
                ימנית; דלי מלא מניח מים ומחזיר דלי ריק.
              </p>
            </section>
            <section>
              <h3>TNT וקרבות</h3>
              <p>
                כאשר המורה מאפשר/ת, בחרו מצית ולחצו G מול TNT ואז התרחקו. תקיפה
                מתבצעת בשמאלי מול שחקן או עם X. הציוד שאתם לובשים עשוי להפחית
                נזק.
              </p>
            </section>
            <section>
              <h3>שמירה וסיום</h3>
              <p>
                העולם נשמר במהלך המשחק וביציאה רגילה. ״השהיית המפגש״ שומרת
                להמשך. ״סיום המפגש״ מסיים את העולם ללא שמירה נוספת להמשך.
              </p>
            </section>
          </>
        )}
        {tab === "food" && (
          <>
            <section>
              <h3>מזון והתאוששות</h3>
              <p>
                מד המזון נפרד ממד החיים. בחרו אוכל בסרגל ולחצו R, או בחרו אוכל
                במלאי ולחצו על אכילה. מזון מספיק מאפשר התאוששות וריצה. נפילה,
                טביעה, לבה, פיצוצים וקרבות עלולים לפגוע בחיים.
              </p>
              <p>
                אספו פריטים שנופלים לידכם ובדקו בספר המתכונים מאכלים ובישול. מד
                האוויר מציין כמה זמן נשאר מתחת למים. אחרי נפילה חוזרים דרך כפתור
                החזרה לעולם; פריטים שנפלו נשארים בעולם.
              </p>
            </section>
            <section>
              <h3>המאכלים במשחק</h3>
              {items
                .filter((item) => item.food)
                .map((item) => (
                  <p key={item.itemType}>
                    <strong>{name(item)}</strong> — {describeItem(item)}
                  </p>
                ))}
            </section>
          </>
        )}
        {tab === "gear" && (
          <>
            <section>
              <h3>לבישת ציוד</h3>
              <p>
                ליד רשת היצירה יש משבצות ראש, גוף, רגליים, כפות רגליים ויד
                שנייה. בחרו פריט במלאי כדי לראות לאיזו משבצת הוא מתאים, ואז גררו
                או העבירו אותו לשם. פריטים בעלי השפעה מהיד צריכים להיות נבחרים
                בסרגל.
              </p>
            </section>
            {items
              .filter((item) => item.equipment || item.activation === "held")
              .map((item) => (
                <section key={item.itemType}>
                  <h3>{name(item)}</h3>
                  <p>{describeItem(item)}</p>
                </section>
              ))}
          </>
        )}
      </div>
    </aside>
  );
}
