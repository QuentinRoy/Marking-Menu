import { dist } from '../utils.js';

/**
 Calculate the length of a stroke.

 @param {List<List<number>>} stroke - An ordered list of 2D coordinates.
 @returns {number} The sum of the euclidean distances between consecutive points.
 */
export default function strokeLength(stroke) {
  let length = 0;
  let previous = stroke[0];
  for (const current of stroke) {
    length += dist(previous, current);
    previous = current;
  }

  return length;
}
