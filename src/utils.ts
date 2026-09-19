/**
 Calculate the modulo of `a` over `n`.

 @param a the dividend
 @param n the divisor
 @returns The modulo of `a` over `n` (% is not exactly modulo but remainder).
 */
export const mod = (a: number, n: number): number => ((a % n) + n) % n;

export const normalizeAngle = (angle: number): number => mod(angle, 360);

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
 Find the smallest gap between neighboring angles around the circle.

 @param angles - Angles in degrees.
 @returns The smallest gap, in degrees, or `Infinity` for fewer than two
 angles.
 */
export const getTightestSpacing = (angles: readonly number[]): number => {
  if (angles.length < 2) {
    return Infinity;
  }

  const sorted = angles.toSorted((a, b) => a - b);
  return Math.min(
    ...sorted.map((angle, index) =>
      mod((sorted[(index + 1) % sorted.length] ?? angle) - angle, 360),
    ),
  );
};

/**
 Calculate the euclidean distance between two
 points.

 @param point1 - The first point
 @param point2 - The second point
 @returns The distance between the two points.
 */
export const dist = (
  point1: readonly number[],
  point2: readonly number[],
): number => {
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
export const angle = (
  a: readonly number[],
  b: readonly number[],
  c: readonly number[],
): number => {
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
 Read `array[index]`, trusting the caller that `index` is in range.

 `noUncheckedIndexedAccess` types every array access as possibly
 `undefined`; use this at a call site where that index is already known
 valid by construction (a modulo-wrapped cyclic index, or one array indexed
 by another built from it) instead of a non-null assertion.

 @param array - The array to read from.
 @param index - An index already known to be within `array`'s bounds.
 @returns The element at `index`.
 */
export function at<Item>(array: readonly Item[], index: number): Item {
  return array[index] as Item;
}

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

/**
 Convert a point in client coordinates to coordinates relative to a bounding
 rectangle's top-left corner (e.g. an element's own
 `getBoundingClientRect()`).

 @param point - A point in client coordinates.
 @param rect - The rectangle to make the point relative to.
 @param rect.left - The rectangle's left edge, in client coordinates.
 @param rect.top - The rectangle's top edge, in client coordinates.
 @returns The point, relative to `rect`'s top-left corner.
 */
export const toLocalPoint = (
  point: Point,
  rect: { left: number; top: number },
): Point => [point[0] - rect.left, point[1] - rect.top];

/**
A function that does nothing. Useful as a default callback.
*/
export const noOp = (): void => {
  // Intentionally empty.
};

/**
 An array with at least one element.
 */
export type NonEmptyArray<Item> = [Item, ...Item[]];

/**
 A list statically known to be empty.
 */
// eslint-disable-next-line @typescript-eslint/no-restricted-types -- This is needed here.
export type EmptyTuple = readonly [];

/**
 Whether `Tuple` is a tuple, i.e. its length is statically known.
 */
export type IsTuple<Tuple extends readonly unknown[]> =
  number extends Tuple['length'] ? false : true;

/**
 A 2D point.

 Readonly: points are values, passed around and stored but never edited in
 place, and the ones carried by events are frozen. Making that the type lets
 `Object.freeze` results flow through without an assertion.
 */
export type Point = readonly [number, number];

/**
 A segment joining two points.
 */
export type Segment = [Point, Point];
