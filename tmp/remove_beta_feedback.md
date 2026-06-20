# מדריך להסרת מערכת משובי בטא (Uninstall Guide)

מדריך זה מפרט את הצעדים הנדרשים להסרה מוחלטת של רכיבי המשוב, צילומי המסך, יומן הפעולות ולוח הבקרה של דיווחי הבטא שנוספו לפרויקט.

---

## 1. מחיקת קבצים חדשים (Delete Files)
מחק את הקבצים הבאים מהפרויקט:
* `apps/web/src/utils/diagnostics.ts`
* `apps/web/src/components/FeedbackModal.tsx`
* `apps/web/src/components/FeedbackTrigger.tsx`
* `apps/web/src/components/AdminFeedbackSection.tsx`

---

## 2. שחזור קבצים שהשתנו (Revert Code Changes)

### א. קובץ הראשי: `apps/web/src/main.tsx`
הסר את השורה הראשונה המייבאת את הדיאגנוסטיקה:
```diff
-import "@/utils/diagnostics";
 import React from "react";
```

### ב. קובץ האפליקציה: `apps/web/src/App.tsx`
1. הסר את הייבוא של כפתור המשוב:
   ```diff
   -import { FeedbackTrigger } from "@/components/FeedbackTrigger";
   ```
2. הסר את הרינדור המותנה של הרכיב:
   ```diff
   -          {user && <FeedbackTrigger />}
   ```

### ג. הגדרות המנוע: `apps/web/src/games/MinecraftClient.tsx`
שחזר את הגדרות מנוע ה-Noa (סביבות שורה 1420) כדי להחזיר את הגדרות המנוע הגרפי לברירת המחדל (הסרת שמירת חוצץ הציור):
```diff
         domElement: hostRef.current,
         chunkSize: 16,
         chunkAddDistance: [10, 8],
-        chunkRemoveDistance: [12, 10],
-        engineOptions: { preserveDrawingBuffer: true }
+        chunkRemoveDistance: [12, 10]
```

### ד. לוח הבקרה של המנהל: `apps/web/src/pages/AdminPage.tsx`
1. הסר את ייבוא הרכיב:
   ```diff
   -import { AdminFeedbackSection } from "@/components/AdminFeedbackSection";
   ```
2. הסר את הקטגוריה `feedback` מטיפוס הסקשנים `AdminSection`:
   ```diff
    type AdminSection =
      | "moderation"
      | "users"
      | "import"
      | "games"
      | "schedule"
      | "stats"
      | "operations"
   -  | "audit"
   -  | "feedback";
   +  | "audit";
   ```
3. הסר את כפתור התפריט עבור המשובים ממערך `adminSections`:
   ```diff
      { id: "stats", label: "סטטיסטיקות" },
-     { id: "feedback", label: "משובי בטא 🐛" },
      { id: "operations", label: "תפעול" },
   ```
4. הסר את הרינדור המותנה של הסקשן בסוף הקובץ:
   ```diff
-     {activeSection === "feedback" && <AdminFeedbackSection />}
    </div>
   ```

---

## 3. הסרת בסיס הנתונים ורכיבי האחסון (Database & Storage Cleanup)

הרץ את ה-SQL הבא ב-**SQL Editor** בלוח הבקרה של Supabase כדי למחוק את הטבלה, רכיבי האחסון ופוליסות ה-RLS:

```sql
-- 1. מחיקת טבלת דיווחי המשוב
DROP TABLE IF EXISTS public.feedback_reports;

-- 2. ניקוי קבצי תמונות מתוך ה-Storage (אם קיימים)
DELETE FROM storage.objects WHERE bucket_id = 'feedback-screenshots';

-- 3. מחיקת תיקיית האחסון (Bucket)
DELETE FROM storage.buckets WHERE id = 'feedback-screenshots';
```
