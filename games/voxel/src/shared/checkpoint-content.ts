import type { ContentManifest } from './content.ts';
// This reviewed transition changes only leaf loot and attachment mining time.
// State IDs/geometry, items, recipes, generator and all saved formats are identical.
// Future content edits must explicitly review compatibility again.
const previous = '2d930b06841018cd0cb4adc65905432e4ffedc3ea2d112bb7ff65a811165307c';
const tuned = '05809e4f10d630b5446d0872e38b1ba7f40263d0a3fb59f5ea3e7c023d190ddc';
const appleTenPercent = '3bacc621111bfbd511d8db591f50a4fdd9298f8659aa2c2187a67e97aeb9b478';
export function compatibleCheckpointContent(hash: unknown, content: ContentManifest): boolean {
  return (
    hash === content.hash ||
    (content.hash === tuned && hash === previous) ||
    (content.hash === appleTenPercent && (hash === previous || hash === tuned))
  );
}
