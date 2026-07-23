import { dist, angle } from '../utils.js';
import type { Point } from '../types.js';

/**
 Find the index of the first point of `pointList` that is at least `minDist` away from a
 reference point.

 @param pointList - The list of points.
 @param options - The lookup's configuration.
 @param options.minDist - A distance.
 @param options.direction - The direction of the lookup: negative values means
 descending lookup.
 @param options.startIndex - The index of the first point to investigate inside
 pointList. If not provided, the lookup will start from the start or the end of
 pointList depending on `direction`.
 @param options.refPoint - The reference point. Defaults to the point at
 `startIndex`.
 @returns The index of the first point inside pointList that it at least `minDist` from
 `refPoint`.
 */
export const findNextPointFurtherThan = (
  pointList: Point[],
  {
    minDist,
    direction = 1,
    startIndex = direction > 0 ? 0 : pointList.length - 1,
    refPoint = pointList[startIndex],
  }: {
    minDist: number;
    direction?: number;
    startIndex?: number;
    refPoint?: Point;
  },
): number => {
  const step = direction / Math.abs(direction);
  const n = pointList.length;
  for (let i = startIndex; i < n && i >= 0; i += step) {
    const point = pointList[i];
    if (
      refPoint !== undefined &&
      point !== undefined &&
      dist(refPoint, point) >= minDist
    ) {
      return i;
    }
  }

  return -1;
};

/**
 Find the point of `pointList` that, as the middle point b, minimizes the angle abc.

 @param pointList - A list of candidate middle points.
 @param options - The angle endpoints and lookup configuration.
 @param options.from - The first endpoint of the angle.
 @param options.to - The last endpoint of the angle.
 @param options.startIndex - The index of the first candidate to investigate inside
 pointList.
 @param options.endIndex - The index of the last candidate to investigate inside
 pointList.
 @returns The index of the candidate that minimizes the angle from-b-to and the
 angle from-b-to.
 */
export const findMiddlePointForMinAngle = (
  pointList: Point[],
  {
    from,
    to,
    startIndex = 0,
    endIndex = pointList.length - 1,
  }: {
    from: Point;
    to: Point;
    startIndex?: number;
    endIndex?: number;
  },
): { index: number; angle: number } => {
  let minAngle = Infinity;
  let minAngleIndex = -1;
  for (let i = startIndex; i <= endIndex; i += 1) {
    const point = pointList[i];
    if (point !== undefined) {
      const thisAngle = angle(from, point, to);
      if (thisAngle < minAngle) {
        minAngle = thisAngle;
        minAngleIndex = i;
      }
    }
  }

  return { index: minAngleIndex, angle: minAngle };
};
