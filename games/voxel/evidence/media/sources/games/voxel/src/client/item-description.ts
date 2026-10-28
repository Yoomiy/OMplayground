import type { ItemDefinition } from '../shared/content.ts';
/** Player-facing equipment information, reusable by the surrounding application HUD. */
export function describeItem(item: ItemDefinition): string {
  const text: string[] = [];
  if (item.collects) text.push('לחיצה על בנייה מול מים ממלאת את הדלי');
  if (item.remainder) text.push('הנחת מים מחזירה דלי ריק');
  if (item.food) text.push(`מזון: עד ${item.food} נקודות`);
  if (item.tool)
    text.push(
      `${{ pickaxe: 'מכוש', axe: 'גרזן', shovel: 'את' }[item.tool.kind]} · דרגה ${item.tool.tier} · מהירות כרייה ×${item.tool.speed}`,
    );
  if (item.activation === 'held') text.push('ההשפעה פעילה כשהפריט נבחר בסרגל');
  else if (item.equipment)
    text.push(
      `מקום ציוד: ${{ head: 'ראש', body: 'גוף', legs: 'רגליים', feet: 'כפות רגליים', offhand: 'יד שנייה' }[item.equipment]}`,
    );
  if (item.modifiers?.speed) text.push(`מהירות תנועה ×${item.modifiers.speed}`);
  if (item.modifiers?.jump) text.push(`עוצמת קפיצה ×${item.modifiers.jump}`);
  if (item.perks?.fallImmune) text.push('חסינות לנזק נפילה');
  else if (item.modifiers?.fall)
    text.push(`הפחתת נזק נפילה ${Math.round(item.modifiers.fall * 100)}%`);
  if (item.modifiers?.armor)
    text.push(`הגנה מתקיפות ומפיצוצים ${Math.round(item.modifiers.armor * 100)}%`);
  if (item.perks?.sunRegen) text.push('ריפוי באור שמש ישיר');
  if (item.perks?.vision) text.push('ראייה משופרת בחושך');
  return text.join(' · ');
}
