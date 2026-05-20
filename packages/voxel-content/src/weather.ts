import type { BiomeColumn } from "./worldgen";

export type PrecipitationKind = "clear" | "rain" | "snow";

export function precipitationKindForBiome(biome: {
  readonly temperature: number;
  readonly downfall: number;
}): PrecipitationKind {
  if (biome.downfall <= 0.3 || biome.temperature >= 1.5) return "clear";
  return biome.temperature <= 0.15 ? "snow" : "rain";
}

export function precipitationKindForColumn(column: BiomeColumn): PrecipitationKind {
  return precipitationKindForBiome(column.biome);
}
