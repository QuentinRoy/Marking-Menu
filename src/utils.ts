import type { Point } from './types.js';

/**
 Calculate the modulo of `a` over `n`.

 @param a the dividend
 @param n the divisor
 @returns The modulo of `a` over `n` (% is not exactly modulo but remainder).
 */
export const mod = (a: number, n: number): number => ((a % n) + n) % n;

/**
 Convert an angle from radians to degrees.

 @param radians an angle in radians
 @returns The angle in degrees.
 */
export const radiansToDegrees = (radians: number): number =>
  radians * (180 / Math.PI);

/**
 Convert an angle from degrees to radians.

 @param degrees an angle in degrees
 @returns The angle in radians.
 */
export const degreesToRadians = (degrees: number): number =>
  degrees * (Math.PI / 180);

/**
 Calculate the signed delta between two angles.

 @param alpha a first angle (in degrees)
 @param beta a second angle (in degrees)
 @returns The (signed) delta between the two angles (in degrees).
 */
export const deltaAngle = (alpha: number, beta: number): number =>
  mod(beta - alpha + 180, 360) - 180;

/**
 Calculate the euclidean distance between two
 points.

 @param point1 - The first point
 @param point2 - The second point
 @returns The distance between the two points.
 */
export const dist = (point1: number[], point2: number[]): number => {
  if (point1.length !== point2.length) {
    throw new Error(
      `Points must have the same dimension. Got ${point1.length} and ${point2.length}.`,
    );
  }

  return Math.hypot(
    ...point1.map(
      (x1i, i) =>
        // Type assertions here is safe because we already checked that the two points
        // have the same dimension, and making ts happy would require unnecessary extra type checks.
        (point2[i] as number) - x1i,
    ),
  );
};

const ANGLE_ROUNDING = 10e-8;
/**
 Calculate the angle abc formed by three points.

 @param a - The first point.
 @param b - The second point, center of the angle.
 @param c - The third point.
 @returns The angle abc (in degrees) rounded at the 8th decimal.
 */
export const angle = (a: number[], b: number[], c: number[]): number => {
  const lab = dist(a, b);
  const lbc = dist(b, c);
  const lac = dist(a, c);
  const cos = (lab ** 2 + lbc ** 2 - lac ** 2) / (2 * lab * lbc);
  // Due to rounding, it can happen than cos ends up being slight > 1 or slightly < -1.
  // This fixes it.
  const adjustedCos = Math.max(-1, Math.min(1, cos));
  const angleAbc = radiansToDegrees(Math.acos(adjustedCos));
  // Round the angle to avoid rounding issues.
  return Math.round(angleAbc / ANGLE_ROUNDING) * ANGLE_ROUNDING;
};

/**
 Find the entry of `list` ranked highest by `comp`.

 @param list - A list of items.
 @param comp - A function comparing two items. Should return a positive number if
 the second item should be ranked higher than the first, a negative number if it
 should be ranked lower and 0 if they should be ranked the same.
 @returns The found `[index, item]` entry. For an empty list, the item is
 `undefined`.
 */
export const findMaxEntry = <T>(
  list: readonly T[],
  comp: (item1: T, item2: T) => number,
): [number, T | undefined] => {
  let result: [number, T | undefined] = [0, list[0]];
  for (const [index, item] of list.entries()) {
    const current = result[1];
    if (current !== undefined && comp(current, item) > 1) {
      result = [index, item];
    }
  }

  return result;
};

/**
 Converts the coordinates of a point in polar coordinates (angle in degrees).

 @param point - A point.
 @param pole - The pole of a polar coordinate system.
 @returns The angle coordinate of the point in the polar coordinate system in
 degrees.
 */
export const toPolar = (
  point: Point,
  pole: Point = [0, 0],
): { azymuth: number; radius: number } => {
  const [px, py] = point;
  const [cx, cy] = pole;
  const x = px - cx;
  const y = py - cy;
  return {
    azymuth: radiansToDegrees(Math.atan2(y, x)),
    radius: Math.hypot(x, y),
  };
};

/** A function that does nothing. Useful as a default callback. */
export const noOp = (): void => {
  // Intentionally empty.
};

/**
  A type that makes some properties of a type optional.
 */
export type SetOptional<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

/**
 An array with at least one element.
 */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 A type that simplifies a type by removing unnecessary intersections and making it more readable.
 */
export type Simplify<T> = T extends infer O
  ? { [K in keyof O]: O[K] } & {}
  : never;

export type DeepReadonly<T> = T extends (...args: any[]) => any
  ? T
  : T extends Array<infer U>
    ? ReadonlyArray<DeepReadonly<U>>
    : T extends Record<string, unknown>
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export function isNonEmptyArray<T>(
  array: readonly T[],
): array is NonEmptyArray<T> {
  return array.length > 0;
}
