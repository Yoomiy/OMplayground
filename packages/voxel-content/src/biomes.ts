export type BiomeId =
  | "ocean"
  | "mountains"
  | "beach"
  | "desert"
  | "savanna"
  | "forest"
  | "plains"
  | "ice_mountains"
  | "iceplains";

export interface BiomeDef {
  readonly id: BiomeId;
  readonly nameHebrew: string;
  readonly temperature: number;
  readonly downfall: number;
  readonly foliageColorHex: string;
  readonly grassColorHex: string;
  readonly waterColorHex: string;
  readonly skyColorHex: string;
  /** @deprecated Procedural ambient in client AudioManager; no asset URL. */
  readonly ambientSoundUrl: string;
}

export const BIOME_DEFS: Record<BiomeId, BiomeDef> = {
  ocean: {
    id: "ocean",
    nameHebrew: "אוקיינוס",
    temperature: 0.5,
    downfall: 0.9,
    foliageColorHex: "#448022",
    grassColorHex: "#397824",
    waterColorHex: "#3f76e4",
    skyColorHex: "#77a2ff",
    ambientSoundUrl: ""
  },
  desert: {
    id: "desert",
    nameHebrew: "מדבר",
    temperature: 2.0,
    downfall: 0.0,
    foliageColorHex: "#8ab03b",
    grassColorHex: "#b5a663",
    waterColorHex: "#37507d",
    skyColorHex: "#e3cc8c",
    ambientSoundUrl: ""
  },
  savanna: {
    id: "savanna",
    nameHebrew: "סוואנה",
    temperature: 1.2,
    downfall: 0.05,
    foliageColorHex: "#84a346",
    grassColorHex: "#b0b05b",
    waterColorHex: "#375f7d",
    skyColorHex: "#ffdc99",
    ambientSoundUrl: ""
  },
  forest: {
    id: "forest",
    nameHebrew: "יער",
    temperature: 0.7,
    downfall: 0.8,
    foliageColorHex: "#277a0f",
    grassColorHex: "#53b533",
    waterColorHex: "#3f76e4",
    skyColorHex: "#a1c2ff",
    ambientSoundUrl: ""
  },
  plains: {
    id: "plains",
    nameHebrew: "מישור",
    temperature: 0.8,
    downfall: 0.4,
    foliageColorHex: "#4c9e22",
    grassColorHex: "#6ec847",
    waterColorHex: "#3f76e4",
    skyColorHex: "#cce0ff",
    ambientSoundUrl: ""
  },
  mountains: {
    id: "mountains",
    nameHebrew: "הרים",
    temperature: 0.2,
    downfall: 0.3,
    foliageColorHex: "#50873a",
    grassColorHex: "#689656",
    waterColorHex: "#45629e",
    skyColorHex: "#ccd6ff",
    ambientSoundUrl: ""
  },
  beach: {
    id: "beach",
    nameHebrew: "חוף",
    temperature: 0.9,
    downfall: 0.5,
    foliageColorHex: "#6d9434",
    grassColorHex: "#a8a660",
    waterColorHex: "#3f76e4",
    skyColorHex: "#cfe7ff",
    ambientSoundUrl: ""
  },
  ice_mountains: {
    id: "ice_mountains",
    nameHebrew: "הרי קרח",
    temperature: 0.0,
    downfall: 0.5,
    foliageColorHex: "#80b497",
    grassColorHex: "#74b391",
    waterColorHex: "#3d577a",
    skyColorHex: "#e0f2ff",
    ambientSoundUrl: ""
  },
  iceplains: {
    id: "iceplains",
    nameHebrew: "מישורי קרח",
    temperature: 0.0,
    downfall: 0.5,
    foliageColorHex: "#80b497",
    grassColorHex: "#74b391",
    waterColorHex: "#3d577a",
    skyColorHex: "#e0f2ff",
    ambientSoundUrl: ""
  }
};

export function biomeDef(id: BiomeId): BiomeDef {
  return BIOME_DEFS[id];
}
