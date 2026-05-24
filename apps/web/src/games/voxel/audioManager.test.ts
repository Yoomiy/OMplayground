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
    expect(voxelSoundDescriptor("step", "grass", 0.4)).toEqual({
      url: "/sounds/step/grass.mp3",
      action: "step",
      group: "grass",
      volume: 0.4
    });
    expect(resolveVoxelSoundUrl("/sounds/break/stone.mp3", 0.9)).toEqual({
      url: "/sounds/break/stone.mp3",
      action: "break",
      group: "stone",
      volume: 0.9
    });
  });

  it("resolves effect descriptors and biome ambient URLs", () => {
    expect(voxelEffectDescriptor("swing", 0.25)).toEqual({
      url: "/sounds/effects/swing.mp3",
      effect: "swing",
      volume: 0.25
    });
    expect(resolveVoxelSoundUrl("/sounds/effects/explosion.mp3", 0.8)).toEqual({
      url: "/sounds/effects/explosion.mp3",
      effect: "explosion",
      volume: 0.8
    });
    expect(ambientUrlForBiome("forest")).toContain("forest");
  });

  it("is a no-op outside browser audio contexts", () => {
    const audio = new AudioManager();
    expect(() => {
      audio.prime();
      audio.updateAmbient("plains");
      audio.playStep("grass");
      audio.playSFX("/sounds/effects/pop.mp3");
      audio.startEating();
      audio.stopEating(true);
      audio.setMuted(true);
      audio.playExplosion();
      audio.setMuted(false);
      audio.dispose();
    }).not.toThrow();
  });
});
