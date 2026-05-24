import { BIOME_DEFS } from "./biomes";
import { precipitationKindForBiome } from "./weather";

describe("@playground/voxel-content weather", () => {
  it("maps biome climate to precipitation type", () => {
    expect(precipitationKindForBiome(BIOME_DEFS.iceplains)).toBe("snow");
    expect(precipitationKindForBiome(BIOME_DEFS.forest)).toBe("rain");
    expect(precipitationKindForBiome(BIOME_DEFS.desert)).toBe("clear");
    expect(precipitationKindForBiome(BIOME_DEFS.savanna)).toBe("clear");
  });
});
