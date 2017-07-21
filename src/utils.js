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

/**
 * Create an observer logging next, errors and complete "events".
 * Handy to debug observable.
 * @param {String} prefix a prefix to append before log messages.
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
 * vectors.
 *
 * @param {List<Number>} vector1
 * @param {List<Number>} vector2
 */
export const dist = (vector1, vector2) => {
  const sum = vector1.reduce((acc, x1i, i) => {
    const x2i = vector2[i];
    return acc + (x2i - x1i) ** 2;
  }, 0);
  return Math.sqrt(sum);
};
