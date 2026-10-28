export const VOXEL_MODEL_KEYS = {
  player: "playground.player"
} as const;

export type VoxelEntityCatalogEntry = {
  /** Cache key for geometry templates in `voxelJsonModel`. */
  modelId: string;
  modelUrl: string;
  textureUrl: string;
  width: number;
  height: number;
  meshOffset: [number, number, number];
};

export const VOXEL_ENTITY_CATALOG: Record<"player", VoxelEntityCatalogEntry> = {
  player: {
    modelId: VOXEL_MODEL_KEYS.player,
    modelUrl: "/minecraft-assets/player.json",
    textureUrl: "/minecraft-assets/alex.png",
    width: 0.6,
    height: 1.8,
    meshOffset: [0, 0.9, 0]
  }
};
