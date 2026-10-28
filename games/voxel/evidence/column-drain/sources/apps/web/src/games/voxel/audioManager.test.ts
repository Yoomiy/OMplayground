import { describe, expect, it } from "vitest";
import {
  AudioManager,
  ambientUrlForBiome,
  resolveVoxelSoundUrl,
  voxelEffectDescriptor,
  voxelSoundDescriptor
} from "./audioManager";

describe("voxel AudioManager helpers", () => {
  it("resolves material URL descriptors", () => {
    const step = voxelSoundDescriptor("step", "grass", 0.4);
    expect(step.action).toBe("step");
    expect(step.group).toBe("grass");
    expect(step.volume).toBe(0.4);
    expect(step.url).toMatch(/^\/minecraft-assets\/sounds\/step\/grass[1-6]\.ogg$/);

    expect(resolveVoxelSoundUrl("/minecraft-assets/sounds/step/stone3.ogg", 0.9)).toEqual({
      url: "/minecraft-assets/sounds/step/stone3.ogg",
      action: "step",
      group: "stone",
      volume: 0.9
    });
  });

  it("resolves effect descriptors and biome ambient URLs", () => {
    expect(voxelEffectDescriptor("craft", 0.25)).toEqual({
      url: "/minecraft-assets/sounds/random/pop.ogg",
      effect: "craft",
      volume: 0.25
    });
    expect(resolveVoxelSoundUrl("/minecraft-assets/sounds/random/explode2.ogg", 0.8)).toEqual({
      url: "/minecraft-assets/sounds/random/explode2.ogg",
      effect: "explosion",
      volume: 0.8
    });
    expect(ambientUrlForBiome("forest")).toBe("");
  });

  it("is a no-op outside browser audio contexts", () => {
    const audio = new AudioManager();
    expect(() => {
      audio.prime();
      audio.updateAmbient("plains");
      audio.playStep("grass");
      audio.playSFX("/minecraft-assets/sounds/random/pop.ogg");
      audio.startEating();
      audio.stopEating(true);
      audio.setMuted(true);
      audio.playExplosion();
      audio.setMuted(false);
      audio.dispose();
    }).not.toThrow();
  });
});
