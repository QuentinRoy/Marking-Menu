/**
 * Calculate the modulo of a over n (% is not exactly modulo but remainder).
 * Modulo is always positive.
 * @param {Number} a the dividend
 * @param {Number} n the divisor
 * @return {Number}
 */
export const mod = (a, n) => (a % n + n) % n;

/**
 * @param {Number} alpha a first angle (in degrees)
 * @param {Number} beta a second angle (in degrees)
 * @return {Number} The (signed) delta between the two angles (in degrees).
 */
export const deltaAngle = (alpha, beta) => mod(beta - alpha + 180, 360) - 180;
