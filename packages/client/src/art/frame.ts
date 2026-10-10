import type { Img } from './image.ts';

/** Which way a sprite looks: toward the viewer, away, or to the right (left is the right one mirrored). */
export type Facing = 'down' | 'up' | 'side';

/** What a unit is doing. */
export type Anim = 'idle' | 'walk' | 'attack';

export const FACINGS: readonly Facing[] = ['down', 'up', 'side'];
export const ANIMS: readonly Anim[] = ['idle', 'walk', 'attack'];

/** Frames per animation. An attack's frames: ready, wind-up, strike, follow-through. */
export const FRAME_COUNT: Record<Anim, number> = { idle: 2, walk: 4, attack: 4 };

/** One drawn frame and the pixel it hangs from: a unit's feet, a tower's base center, an effect's middle. */
export interface Frame {
  img: Img;
  ax: number;
  ay: number;
}

/** Every frame of a unit for one side. */
export type UnitFrames = Record<Anim, Record<Facing, Frame[]>>;
