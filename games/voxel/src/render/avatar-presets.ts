import { AVATAR_PRESETS as UPSTREAM_PRESETS, type Avatar } from './upstream/blockyard/avatar.ts';

type AvatarPreset = { readonly name: string; readonly avatar: Avatar };
const skirt = 3; // AVATAR_OPTIONS.bottom: Skirt.
const female = (name: string, choices: Partial<Avatar>): AvatarPreset => ({
  name,
  avatar: {
    ...UPSTREAM_PRESETS[6].avatar,
    ...choices,
    curvy: 1,
    facialHair: 0,
    bottom: skirt,
  },
});

/** Local outfits use the unchanged Blockyard builder. Original preset indices stay stable. */
export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  ...UPSTREAM_PRESETS.map((preset, index) => ({
    ...preset,
    // Keep Skater's face/hair/outfit colours, replacing the original shorts with a denim skirt.
    avatar: { ...preset.avatar, ...(index === 2 ? { bottom: skirt } : {}) },
  })),
  // Long auburn hair, pink collared shirt, charcoal skirt and black flats.
  female('Rose', {
    build: 0,
    tone: 2,
    hair: 5,
    hairColor: 3,
    face: 1,
    eyes: 2,
    top: 1,
    topColor: 9,
    accent: 10,
    bottomColor: 12,
    shoes: 3,
    shoeColor: 0,
  }),
  // Afro, white sweater, forest-green skirt and brown flats.
  female('Meadow', {
    build: 1,
    tone: 6,
    hair: 10,
    hairColor: 0,
    face: 0,
    eyes: 0,
    top: 3,
    topColor: 10,
    accent: 4,
    bottomColor: 5,
    shoes: 3,
    shoeColor: 2,
  }),
  // Dark bun and glasses; matching navy tunic and skirt form a dress-like outfit.
  female('Marina', {
    build: 0,
    tone: 4,
    hair: 9,
    hairColor: 0,
    face: 5,
    eyes: 3,
    top: 10,
    topColor: 7,
    accent: 10,
    bottomColor: 7,
    shoes: 3,
    shoeColor: 0,
  }),
  // Ginger bob and freckles, yellow tee, tan skirt and brown boots.
  female('Sunflower', {
    build: 1,
    tone: 1,
    hair: 7,
    hairColor: 4,
    face: 3,
    eyes: 1,
    top: 0,
    topColor: 3,
    accent: 10,
    bottomColor: 15,
    shoes: 2,
    shoeColor: 2,
  }),
];
