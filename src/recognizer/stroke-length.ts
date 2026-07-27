import { dist } from '../utils.js';

/**
 Calculate the length of a stroke.

 @param stroke - An ordered list of coordinates.
 @returns The sum of the euclidean distances between consecutive points.
 */
export function strokeLength(stroke: number[][]): number {
  let length = 0;
  let previous = stroke[0];
  if (previous === undefined) {
    return length;
  }

  for (let i = 1; i < stroke.length; i++) {
    // Type assertions here is safe because we know i is a valid index
    // of the stroke array, and making ts happy would require unnecessary
    // type checks.
    const current = stroke[i] as number[];
    length += dist(previous, current);
    previous = current;
  }

  return length;
}
