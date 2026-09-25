import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus';

/**
 A deterministic `[0, 1)` random source, shared by the stroke generator (to
 seed `simplex-noise`) and the stroke corpus (to pick random paths and
 per-trial seeds), so both are reproducible across machines and CI runs.

 @param seed - Two calls with the same seed produce the exact same sequence.
 @returns A function returning a new `[0, 1)` value on every call.
 */
export const createRandom = (seed: number): (() => number) => {
  const generator = xoroshiro128plus(seed);
  return () => {
    // `next()` is a signed 32-bit int; shift it up into `[0, 2^32)` before
    // scaling down to `[0, 1)`.
    const value = generator.next();
    return (value < 0 ? value + 0x1_00_00_00_00 : value) / 0x1_00_00_00_00;
  };
};
