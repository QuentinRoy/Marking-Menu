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
 * @param {String} [prefix] - A prefix to append before log messages.
 * @return {Observable} An observer logging next, errors and complete "events".
 *                      Handy to debug observable.
 */
export const logObservable = prefix => {
  const fixedPrefix = prefix ? `${prefix} ` : '';
  return {
    next(e) {
      // eslint-disable-next-line no-console
      console.log(`${fixedPrefix}next`, e);
    },
    error(e) {
      // eslint-disable-next-line no-console
      console.error(`${fixedPrefix}error`, e);
    },
    complete() {
      // eslint-disable-next-line no-console
      console.log(`${fixedPrefix}complete`);
    }
  };
};

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
