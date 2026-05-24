import { BLOCK_REGISTRY, ITEM_REGISTRY } from "@playground/voxel-content";
import { createEmptyEquipmentSlots, createEmptyHotbar } from "./inventory";
import {
  HELIOS_REGEN_INTERVAL_MS,
  VOXEL_DAY_LENGTH_MS,
  applyFallDamage,
  applyPlayerDamage,
  heldWeaponDamage,
  tickHeliosRegen
} from "./perks";
import type { PlayerRuntime } from "./room";
import { applyDelta, createWorld } from "./world";

function survivalPlayer(): PlayerRuntime {
  return {
    userId: "u1",
    displayName: "A",
    pos: [0.5, 100, 0.5],
    heading: 0,
    pitch: 0,
    jumping: false,
    t: 0,
    lastInputAt: 0,
    selectedHotbarIndex: 0,
    health: 10,
    hunger: 20,
    saturation: 5,
    exhaustion: 0,
    lastVitalsAt: 0,
    lastRegenAt: 0,
    lastStarveAt: 0,
    lastHeliosRegenAt: 0,
    equipmentSlots: createEmptyEquipmentSlots()
  };
}

describe("server perk hooks", () => {
  it("regenerates Helios health only after direct daytime exposure", () => {
    const world = createWorld(12345);
    const player = survivalPlayer();
    player.equipmentSlots![0] = {
      itemId: ITEM_REGISTRY.HELIOS_MEDALLION,
      count: 1
    };

    expect(tickHeliosRegen(player, world, HELIOS_REGEN_INTERVAL_MS - 1)).toBe(false);
    expect(player.health).toBe(10);
    expect(tickHeliosRegen(player, world, HELIOS_REGEN_INTERVAL_MS)).toBe(true);
    expect(player.health).toBe(11);
  });

  it("blocks Helios regen when a solid block interrupts the sky column", () => {
    const world = createWorld(12345);
    const player = survivalPlayer();
    player.equipmentSlots![0] = {
      itemId: ITEM_REGISTRY.HELIOS_MEDALLION,
      count: 1
    };
    applyDelta(world, 0, 104, 0, BLOCK_REGISTRY.STONE);

    expect(tickHeliosRegen(player, world, HELIOS_REGEN_INTERVAL_MS)).toBe(false);
    expect(player.health).toBe(10);
  });

  it("does not run Helios regen during the night phase", () => {
    const world = createWorld(12345);
    const player = survivalPlayer();
    player.equipmentSlots![0] = {
      itemId: ITEM_REGISTRY.HELIOS_MEDALLION,
      count: 1
    };

    expect(tickHeliosRegen(player, world, VOXEL_DAY_LENGTH_MS * 0.75)).toBe(false);
    expect(player.health).toBe(10);
  });

  it("applies heavy shield damage reduction through the damage helper", () => {
    const player = survivalPlayer();
    player.health = 20;
    player.equipmentSlots![1] = {
      itemId: ITEM_REGISTRY.HEAVY_SHIELD,
      count: 1
    };

    expect(applyPlayerDamage(player, 6, "combat")).toBe(3);
    expect(player.health).toBe(17);
  });

  it("absorbs fall damage with the feather falling talisman", () => {
    const player = survivalPlayer();
    player.health = 20;
    player.equipmentSlots![2] = {
      itemId: ITEM_REGISTRY.FEATHER_FALLING_TALISMAN,
      count: 1
    };

    expect(applyFallDamage(player, -18)).toBe(0);
    expect(player.health).toBe(20);
  });

  it("computes fall damage without the talisman", () => {
    const player = survivalPlayer();
    player.health = 20;

    expect(applyFallDamage(player, -18)).toBe(9);
    expect(player.health).toBe(11);
  });

  it("derives combat damage from the selected hotbar tool tier", () => {
    const player = survivalPlayer();
    player.inventory = createEmptyHotbar();
    player.selectedHotbarIndex = 2;
    player.inventory[2] = {
      blockId: BLOCK_REGISTRY.AIR,
      itemId: ITEM_REGISTRY.DIAMOND_AXE,
      count: 1
    };

    expect(heldWeaponDamage(player)).toBe(6);
  });
});
