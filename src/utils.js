/**
 Calculate the modulo of `a` over `n`.

 @param {number} a the dividend
 @param {number} n the divisor
 @returns {number} The modulo of `a` over `n` (% is not exactly modulo but remainder).
 */
export const mod = (a, n) => ((a % n) + n) % n;

/**
 Convert an angle from radians to degrees.

 @param {number} radians an angle in radians
 @returns {number} The angle in degrees.
 */
export const radiansToDegrees = (radians) => radians * (180 / Math.PI);

/**
 Convert an angle from degrees to radians.

 @param {number} degrees an angle in degrees
 @returns {number} The angle in radians.
 */
export const degreesToRadians = (degrees) => degrees * (Math.PI / 180);

/**
 Calculate the signed delta between two angles.

 @param {number} alpha a first angle (in degrees)
 @param {number} beta a second angle (in degrees)
 @returns {number} The (signed) delta between the two angles (in degrees).
 */
export const deltaAngle = (alpha, beta) => mod(beta - alpha + 180, 360) - 180;

/**
 Calculate the euclidean distance between two
 points.

 @param {List<number>} point1 - The first point
 @param {List<number>} point2 - The second point
 @returns {number} The distance between the two points.
 */
export const dist = (point1, point2) =>
  Math.hypot(...point1.map((x1i, i) => point2[i] - x1i));

const ANGLE_ROUNDING = 10e-8;
/**
 Calculate the angle abc formed by three points.

 @param {number[]} a - The first point.
 @param {number[]} b - The second point, center of the angle.
 @param {number[]} c - The third point.
 @returns {number} The angle abc (in degrees) rounded at the 8th decimal.
 */
export const angle = (a, b, c) => {
  const lab = dist(a, b);
  const lbc = dist(b, c);
  const lac = dist(a, c);
  const cos = (lab ** 2 + lbc ** 2 - lac ** 2) / (2 * lab * lbc);
  // Due to rounding, it can happen than cos ends up being slight > 1 or slightly < -1.
  // This fixes it.
  const adjustedCos = Math.max(-1, Math.min(1, cos));
  const angleABC = radiansToDegrees(Math.acos(adjustedCos));
  // Round the angle to avoid rounding issues.
  return Math.round(angleABC / ANGLE_ROUNDING) * ANGLE_ROUNDING;
};

/**
 @callback findMaxEntryComp
 @param {unknown} item1 - A first item.
 @param {unknown} item2 - A second item.
 @returns {number} A positive number if the second item should be ranked higher than the first,
 a negative number if it should be ranked lower and 0 if they should be ranked
 the same.
 */

/**
 Find the entry of `list` ranked highest by `comp`.

 @param {List} list - A list of items.
 @param {findMaxEntryComp} comp - A function to calculate a value from an item.
 @returns {[index, item]} The found entry.
 */
export const findMaxEntry = (list, comp) => {
  let result = [0, list[0]];
  for (const [index, item] of [...list].entries()) {
    if (comp(result[1], item) > 1) {
      result = [index, item];
    }
  }

  return result;
};

/**
 Converts the coordinates of a point in polar coordinates (angle in degrees).

 @param {number[]} point - A point.
 @param {number[]} [pole=[0, 0]] - The pole of a polar coordinate
 system
 @returns {{azymuth, radius}} The angle coordinate of the point in the polar
 coordinate system in degrees.
 */
export const toPolar = ([px, py], [cx, cy] = [0, 0]) => {
  const x = px - cx;
  const y = py - cy;
  return {
    azymuth: radiansToDegrees(Math.atan2(y, x)),
    radius: Math.hypot(x, y),
  };
};

/** A function that does nothing. Useful as a default callback. */
export const noOp = () => {};
