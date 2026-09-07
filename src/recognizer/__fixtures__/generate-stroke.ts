import { createNoise2D } from 'simplex-noise';
import { degreesToRadians, type Point } from '../../utils.js';
import { createRandom } from './random.js';

/*
 A test-only stroke generator, used by the generated stroke corpus (see
 `../generated-stroke-corpus.test.ts`).

 A stroke drawn through a set of directions with no noise at all is a
 straight polyline that lands dead center of every target every time, no
 matter how crowded the menu is. That kind of corpus would recognize
 everything and prove nothing. What makes a corpus meaningful is wobble
 shaped like the way a hand actually moves: a slow, smooth wander off the
 intended heading, plus a finer tremor, rather than an independent random
 offset at every point (which would look like static, not a hand). Simplex
 noise is built for exactly that: a continuous, seedable signal, instead of
 the manual smoothing a point-by-point random walk would need to stop
 looking jagged.
 */

/**
 How much a generated stroke wobbles off the straight path its angles
 describe.
 */
export type Wobble = {
  /**
  How far, in degrees, the heading wanders off the intended direction.
  */
  readonly headingWander: number;
  /**
  How far, in pixels, the pen drifts sideways off the intended path.
  */
  readonly lateralWander: number;
  /**
  The arc length, in pixels, of one full wander oscillation. The finer
  lateral tremor oscillates four times as fast, which is close enough to real
  strokes without adding a second knob nobody would tune independently.
  */
  readonly wavelength: number;
  /**
  The arc length, in pixels, before a corner over which the heading eases
  into the next segment instead of turning on a dime.
  */
  readonly cornerRadius: number;
};

/**
 The wobble calibrated against the real 4- and 8-item menus the library lays
 out evenly today (see `generated-stroke-corpus.test.ts` for the calibration
 itself, and its comment for the reasoning). Frozen once calibrated: retuning
 it changes what every generated-corpus test measures.
 */
export const CALIBRATED_WOBBLE: Wobble = {
  headingWander: 8,
  lateralWander: 4,
  wavelength: 140,
  cornerRadius: 45,
};

const shortestAngleDelta = (from: number, to: number): number => {
  const twoPi = 2 * Math.PI;
  const delta = ((to - from + Math.PI) % twoPi) - Math.PI;
  return delta < -Math.PI ? delta + twoPi : delta;
};

/**
 Generate the points of a stroke drawn through a known sequence of
 directions, with wobble added.

 @param options - Configuration options.
 @param options.angles - The direction of each segment of the intended path,
 in degrees, in the same convention as a model item's `angle`: one entry per
 menu level, in the order the stroke should walk them.
 @param options.segmentLength - The length, in pixels, of each straight
 segment before wobble is applied.
 @param options.stepSize - The distance, in pixels, between two consecutive
 generated points.
 @param options.wobble - The wobble to apply. Defaults to the calibrated one;
 pass a different one to explore how the corpus reacts to more or less noise.
 @param options.seed - The seed for the noise. Two calls with the same
 arguments and seed produce the exact same points.
 @returns The points of the generated stroke, starting at the origin.
 */
export function generateStroke({
  angles,
  segmentLength = 200,
  stepSize = 5,
  wobble = CALIBRATED_WOBBLE,
  seed = 1,
}: {
  angles: readonly number[];
  segmentLength?: number;
  stepSize?: number;
  wobble?: Wobble;
  seed?: number;
}): Point[] {
  const [firstAngle] = angles;
  if (firstAngle === undefined) {
    return [];
  }

  const random = createRandom(seed);
  // Two independent channels off the same seed: a slow heading wander and a
  // finer lateral tremor, so the two don't move in lockstep.
  const headingNoise = createNoise2D(random);
  const lateralNoise = createNoise2D(random);

  const totalLength = segmentLength * angles.length;
  const points: Point[] = [[0, 0]];
  let [x, y] = [0, 0];
  for (let traveled = 0; traveled < totalLength; traveled += stepSize) {
    const segmentIndex = Math.min(
      Math.floor(traveled / segmentLength),
      angles.length - 1,
    );
    const targetAngle = degreesToRadians(angles[segmentIndex] ?? firstAngle);
    const nextAngle = degreesToRadians(
      angles[segmentIndex + 1] ?? angles[segmentIndex] ?? firstAngle,
    );
    const distanceToCorner =
      segmentLength - (traveled - segmentIndex * segmentLength);
    const cornerEasing =
      segmentIndex + 1 < angles.length && distanceToCorner < wobble.cornerRadius
        ? 1 - distanceToCorner / wobble.cornerRadius
        : 0;
    const easedTarget =
      targetAngle + cornerEasing * shortestAngleDelta(targetAngle, nextAngle);

    const heading =
      easedTarget +
      degreesToRadians(
        headingNoise(traveled / wobble.wavelength, 0) * wobble.headingWander,
      );
    const step = Math.min(stepSize, totalLength - traveled);
    x += Math.cos(heading) * step;
    y += Math.sin(heading) * step;

    const lateralOffset =
      lateralNoise(traveled / (wobble.wavelength / 4), 0) *
      wobble.lateralWander;
    const perpendicular = heading + Math.PI / 2;
    points.push([
      x + Math.cos(perpendicular) * lateralOffset,
      y + Math.sin(perpendicular) * lateralOffset,
    ]);
  }

  return points;
}
