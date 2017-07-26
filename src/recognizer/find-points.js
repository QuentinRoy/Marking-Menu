import { dist, angle } from '../utils';

/**
   * @param {Array.<number[]>} pointList - The list of points.
   * @param {number} minDist - A distance.
   * @param {object} options - Options.
   * @param {number} [options.direction=1] - The direction of the lookup: negative values means
   *                                         descending lookup.
   * @param {number} [options.startIndex] - The index of the first point to investigate inside
   *                                        pointList. If not provided, the lookup will start
   *                                        from the start or the end of pointList depending
   *                                        on `direction`.
   * @param {number[]} [options.refPoint=pointList[startIndex]] - The reference point.
   * @return {number} The index of the first point inside pointList that it at least `minDist` from
   *                  `refPoint`.
   */
export const findNextPointFurtherThan = (
  pointList,
  minDist,
  {
    direction = 1,
    startIndex = direction > 0 ? 0 : pointList.length - 1,
    refPoint = pointList[startIndex]
  } = {}
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
 * @param {number[]} pointA - The point a.
 * @param {number[]} pointC - The point b.
 * @param {List.<number[]>} pointList - A list of points.
 * @param {number[]} options - Options.
 * @param {number} [options.startIndex=0] - The index of the first point to investigate inside
 *                                          pointList.
 * @param {number} [options.endIndex=pointList.length - 1] - The index of the first point to
 *                                                           investigate inside pointList.
 * @return {{index, angle}} The index of the point b of pointList that maximizes the angle abc and
 *                          the angle abc.
 */
export const findMiddlePointForMinAngle = (
  pointA,
  pointC,
  pointList,
  { startIndex = 0, endIndex = pointList.length - 1 } = {}
) => {
  let minAngle = Infinity;
  let maxAngleIndex = -1;
  for (let i = startIndex; i <= endIndex; i += 1) {
    const thisAngle = angle(pointA, pointList[i], pointC);
    if (thisAngle < minAngle) {
      minAngle = thisAngle;
      maxAngleIndex = i;
    }
  }
  return { index: maxAngleIndex, angle: minAngle };
};
