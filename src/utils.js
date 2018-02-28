import rad2deg from 'rad2deg';

/**
 * @param {number} a the dividend
 * @param {number} n the divisor
 * @return {number} The modulo of `a` over `n` (% is not exactly modulo but remainder).
 */
export const mod = (a, n) => (a % n + n) % n;

/**
 * @param {number} alpha a first angle (in degrees)
 * @param {number} beta a second angle (in degrees)
 * @return {number} The (signed) delta between the two angles (in degrees).
 */
export const deltaAngle = (alpha, beta) => mod(beta - alpha + 180, 360) - 180;

/**
 * Calculate the euclidean distance between two
 * points.
 *
 * @param {List<number>} point1 - The first point
 * @param {List<number>} point2 - The second point
 * @return {number} The distance between the two points.
 */
export const dist = (point1, point2) => {
  const sum = point1.reduce((acc, x1i, i) => {
    const x2i = point2[i];
    return acc + (x2i - x1i) ** 2;
  }, 0);
  return Math.sqrt(sum);
};

const ANGLE_ROUNDING = 10e-8;
/**
 * @param {number[]} a - The first point.
 * @param {number[]} b - The second point, center of the angle.
 * @param {number[]} c - The third point.
 * @return {number} The angle abc (in degrees) rounded at the 8th decimal.
 */
export const angle = (a, b, c) => {
  const lab = dist(a, b);
  const lbc = dist(b, c);
  const lac = dist(a, c);
  const cos = (lab ** 2 + lbc ** 2 - lac ** 2) / (2 * lab * lbc);
  // Due to rounding, it can happen than cos ends up being slight > 1 or slightly < -1.
  // This fixes it.
  const adjustedCos = Math.max(-1, Math.min(1, cos));
  const angleABC = rad2deg(Math.acos(adjustedCos));
  // Round the angle to avoid rounding issues.
  return Math.round(angleABC / ANGLE_ROUNDING) * ANGLE_ROUNDING;
};

/**
 * @callback findMaxEntryComp
 * @param {*} item1 - A first item.
 * @param {*} item2 - A second item.
 * @return {number} A positive number if the second item should be ranked higher than the first,
 *                  a negative number if it should be ranked lower and 0 if they should be ranked
 *                  the same.
 */

/**
 * @param {List} list - A list of items.
 * @param {findMaxEntryComp} comp - A function to calculate a value from an item.
 * @return {[index, item]} The found entry.
 */
export const findMaxEntry = (list, comp) =>
  list.slice(0).reduce(
    (result, item, index) => {
      if (comp(result[1], item) > 1) return [index, item];
      return result;
    },
    [0, list[0]]
  );

/**
 * Converts the coordinates of a point in polar coordinates (angle in degrees).
 *
 * @param  {number[]} point - A point.
 * @param  {number[]} [pole=[0, 0]] - The pole of a polar coordinate
 *                                    system
 * @return {{azymuth, radius}} The angle coordinate of the point in the polar
 *                             coordinate system in degrees.
 */
export const toPolar = ([px, py], [cx, cy] = [0, 0]) => {
  const x = px - cx;
  const y = py - cy;
  return {
    azymuth: rad2deg(Math.atan2(y, x)),
    radius: Math.sqrt(x * x + y * y)
  };
};

/**
 * @param  {string} str - A valid html fragment that could be contained in a
 *                      <div>.
 * @param  {Document} [doc=document] - The document to use.
 * @return {HTMLCollection} - The html fragment parsed as an HTML collection.
 *
 * Warning: any content that cannot be directly contained in a div, e.g. <td />
 * will fail.
 */
export const strToHTML = (str, doc = document) => {
  const div = doc.createElement('div');
  div.innerHTML = str;
  return div.children;
};
