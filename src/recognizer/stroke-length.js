import { dist } from '../utils';

/**
 * @param {List<List<number>>} stroke - A stroke.
 * @return {number} The length of the stroke `stroke`.
 */
export default stroke =>
  stroke.reduce(
    (res, current) => {
      const prev = res.prev || current;
      return {
        prev: current,
        length: res.length + dist(prev, current)
      };
    },
    { length: 0 }
  ).length;
