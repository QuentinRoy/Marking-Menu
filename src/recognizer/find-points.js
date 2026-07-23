import { dist, angle } from '../utils.js';

/**
 Find the index of the first point of `pointList` that is at least `minDist` away from a
 reference point.

 @param {Array.<number[]>} pointList - The list of points.
 @param {number} minDist - A distance.
 @param {object} lookupOptions - The lookup's configuration.
 @param {number} [lookupOptions.direction=1] - The direction of the lookup: negative values means
 descending lookup.
 @param {number} [lookupOptions.startIndex] - The index of the first point to investigate inside
 pointList. If not provided, the lookup will start
 from the start or the end of pointList depending
 on `direction`.
 @param {number[]} [lookupOptions.refPoint=pointList[startIndex]] - The reference point.
 @returns {number} The index of the first point inside pointList that it at least `minDist` from
 `refPoint`.
 */
export const findNextPointFurtherThan = (
  pointList,
  minDist,
  {
    direction = 1,
    startIndex = direction > 0 ? 0 : pointList.length - 1,
    refPoint = pointList[startIndex],
  } = {},
) => {
  const step = direction / Math.abs(direction);
  const n = pointList.length;
  for (let i = startIndex; i < n && i >= 0; i += step) {
    if (dist(refPoint, pointList[i]) >= minDist) {
      return i;
    }
  }

  return -1;
};

/**
 Find the point of `pointList` that, as the middle point b, minimizes the angle abc.

 @param {object} options - The lookup's configuration.
 @param {number[]} options.pointA - The first point of the angle.
 @param {number[]} options.pointC - The last point of the angle.
 @param {number[][]} options.pointList - A list of points.
 @param {number} [options.startIndex=0] - The index of the first point to investigate inside
 pointList.
 @param {number} [options.endIndex=pointList.length - 1] - The index of the last point to
 investigate inside pointList.
 @returns {{index, angle}} The index of the point b of pointList that minimizes the angle abc and
 the angle abc.
 */
export const findMiddlePointForMinAngle = ({
  pointA,
  pointC,
  pointList,
  startIndex = 0,
  endIndex = pointList.length - 1,
}) => {
  let minAngle = Infinity;
  let minAngleIndex = -1;
  for (let i = startIndex; i <= endIndex; i += 1) {
    const thisAngle = angle(pointA, pointList[i], pointC);
    if (thisAngle < minAngle) {
      minAngle = thisAngle;
      minAngleIndex = i;
    }
  }

  return { index: minAngleIndex, angle: minAngle };
};
