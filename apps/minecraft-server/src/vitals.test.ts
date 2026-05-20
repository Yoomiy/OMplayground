import {
  addExhaustion,
  applyFood,
  createDefaultVitals,
  tickVitals
} from "./vitals";

describe("survival vitals", () => {
  it("spends exhaustion on saturation before hunger", () => {
    const player = createDefaultVitals(0);
    player.hunger = 20;
    player.saturation = 2;
    player.exhaustion = 8;

    expect(tickVitals(player, 0)).toBe(true);
    expect(player.saturation).toBe(0);
    expect(player.hunger).toBe(20);
    expect(player.exhaustion).toBe(0);
  });

  it("spends exhaustion on hunger when saturation is gone", () => {
    const player = createDefaultVitals(0);
    player.hunger = 20;
    player.saturation = 0;
    addExhaustion(player, 4);

    expect(tickVitals(player, 0)).toBe(true);
    expect(player.hunger).toBe(19);
    expect(player.saturation).toBe(0);
  });

  it("regenerates health when hunger is high", () => {
    const player = createDefaultVitals(0);
    player.health = 18;
    player.hunger = 20;
    player.saturation = 2;
    player.lastRegenAt = 0;

    expect(tickVitals(player, 4000)).toBe(true);
    expect(player.health).toBe(19);
    expect(player.saturation).toBe(1);
  });

  it("starves when hunger reaches zero", () => {
    const player = createDefaultVitals(0);
    player.health = 20;
    player.hunger = 0;
    player.saturation = 0;
    player.lastStarveAt = 0;

    expect(tickVitals(player, 4000)).toBe(true);
    expect(player.health).toBe(19);
  });

  it("applies food up to hunger and saturation caps", () => {
    const player = createDefaultVitals(0);
    player.hunger = 10;
    player.saturation = 1;

    expect(applyFood(player, 5, 2)).toBe(true);
    expect(player.hunger).toBe(15);
    expect(player.saturation).toBe(11);
  });
});
