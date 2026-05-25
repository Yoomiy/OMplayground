import {
  addExhaustion,
  applyFood,
  createDefaultVitals,
  tickVitals
} from "./vitals";

describe("survival vitals", () => {
  it("does not spend exhaustion on saturation or hunger", () => {
    const player = createDefaultVitals(0);
    player.hunger = 20;
    player.saturation = 2;
    player.exhaustion = 4;

    expect(tickVitals(player, 0)).toBe(false);
    expect(player.saturation).toBe(2);
    expect(player.hunger).toBe(20);
    expect(player.exhaustion).toBe(4);
  });

  it("does not passively regenerate health over time", () => {
    const player = createDefaultVitals(0);
    player.health = 15;
    player.hunger = 20;
    player.lastRegenAt = 0;

    expect(tickVitals(player, 4000)).toBe(false);
    expect(player.health).toBe(15);
  });

  it("does not take starvation damage at zero hunger", () => {
    const player = createDefaultVitals(0);
    player.health = 20;
    player.hunger = 0;
    player.lastStarveAt = 0;

    expect(tickVitals(player, 4000)).toBe(false);
    expect(player.health).toBe(20);
  });

  it("restores health directly from food up to health cap", () => {
    const player = createDefaultVitals(0);
    player.health = 12;

    expect(applyFood(player, 5, 2)).toBe(true);
    expect(player.health).toBe(17);
    expect(player.hunger).toBe(20);
    expect(player.saturation).toBe(0);

    expect(applyFood(player, 10, 2)).toBe(true);
    expect(player.health).toBe(20);
  });

  it("does not drain hunger from long periods", () => {
    const player = createDefaultVitals(0);
    player.hunger = 20;

    expect(tickVitals(player, 60_000)).toBe(false);
    expect(player.hunger).toBe(20);
  });
});
