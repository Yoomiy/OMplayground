import type { ContentManifest } from './content.ts';
// These reviewed transitions change only leaf loot and attachment/leaf mining time.
// State IDs/geometry, items, recipes, generator and all saved formats are identical.
// Future content edits must explicitly review compatibility again.
const previous = '2d930b06841018cd0cb4adc65905432e4ffedc3ea2d112bb7ff65a811165307c';
const tuned = '05809e4f10d630b5446d0872e38b1ba7f40263d0a3fb59f5ea3e7c023d190ddc';
const appleTenPercent = '3bacc621111bfbd511d8db591f50a4fdd9298f8659aa2c2187a67e97aeb9b478';
const instantLeaves = '2901239743859cde06ec4544cb84bb22f0c6062c4f83234dc2f8ac0d380cd21a';
export function compatibleCheckpointContent(hash: unknown, content: ContentManifest): boolean {
  return (
    hash === content.hash ||
    (content.hash === tuned && hash === previous) ||
    (content.hash === appleTenPercent && (hash === previous || hash === tuned)) ||
    (content.hash === instantLeaves &&
      (hash === previous || hash === tuned || hash === appleTenPercent))
  );
}
