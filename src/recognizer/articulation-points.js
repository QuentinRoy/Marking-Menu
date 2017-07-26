import {
  findNextPointFurtherThan,
  findMiddlePointForMinAngle
} from './find-points';

/**
 * @typedef {number[]} Point
 */

/**
 * A segment.
 * @typedef {Point[2]} Segment
 */

/**
 * @param {Point[]} stroke - The points of a stroke.
 * @param {number} expectedSegmentLength - The expected length of a segment
 *                                         (usually strokeLength / maxMenuDepth).
 * @param {number} angleThreshold - The min angle threshold in a point required for it to be
 *                                  considered an articulation points.
 * @return {Point[]} The list of articulation points.
 */
const getStrokeArticulationPoints = (
  stroke,
  expectedSegmentLength,
  angleThreshold
) => {
  const n = stroke.length;
  if (n === 0) return [];
  const w = expectedSegmentLength * 0.3;

  // Add the first point of the stroke.
  const articulationPoints = [stroke[0]];

  let ai = 0;
  let a = stroke[ai];
  while (ai < n) {
    const ci = findNextPointFurtherThan(stroke, w, {
      startIndex: ai + 2,
      refPoint: a
    });
    if (ci < 0) break;
    const c = stroke[ci];
    const labi = findNextPointFurtherThan(stroke, w / 8, {
      startIndex: ai + 1,
      refPoint: a
    });
    const lbci = findNextPointFurtherThan(stroke, w / 8, {
      startIndex: ci - 1,
      refPoint: c,
      direction: -1
    });
    const { index: bi, angle: angleABC } = findMiddlePointForMinAngle(
      a,
      stroke[ci],
      stroke,
      {
        startIndex: labi,
        endIndex: lbci
      }
    );
    if (bi > 0 && Math.abs(180 - angleABC) > angleThreshold) {
      const b = stroke[bi];
      articulationPoints.push(b);
      a = b;
      ai = bi;
    } else {
      ai += 1;
      a = stroke[ai];
    }
  }

  // Add the last point of the stroke.
  articulationPoints.push(stroke[stroke.length - 1]);
  return articulationPoints;
};

export default getStrokeArticulationPoints;
