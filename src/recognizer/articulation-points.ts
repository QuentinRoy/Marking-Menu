import type { Point } from '../types.js';
import {
  findNextPointFurtherThan,
  findMiddlePointForMinAngle,
} from './find-points.js';

/**
 Find the articulation points of a stroke.

 @param stroke - The points of a stroke.
 @param options - Configuration options.
 @param options.expectedSegmentLength - The expected length of a segment
 (usually strokeLength / maxMenuDepth).
 @param options.angleThreshold - The min angle threshold in a point required for it to be
 considered an articulation points.
 @returns The list of articulation points.
 */
export default function getStrokeArticulationPoints(
  stroke: Point[],
  {
    expectedSegmentLength,
    angleThreshold,
  }: { expectedSegmentLength: number; angleThreshold: number },
): Point[] {
  const n = stroke.length;
  const first = stroke[0];
  if (first === undefined) {
    return [];
  }

  const w = expectedSegmentLength * 0.3;

  // Add the first point of the stroke.
  const articulationPoints: Point[] = [first];

  let ai = 0;
  while (ai < n) {
    const a = stroke[ai];
    if (a === undefined) {
      // Cannot happen (`ai < n`), but narrows the type of `a`.
      break;
    }

    const ci = findNextPointFurtherThan(stroke, {
      minDist: w,
      startIndex: ai + 2,
      refPoint: a,
    });
    if (ci < 0) {
      break;
    }

    const c = stroke[ci];
    if (c === undefined) {
      // Cannot happen (`ci` is a valid index), but narrows the type of `c`.
      break;
    }

    const labi = findNextPointFurtherThan(stroke, {
      minDist: w / 8,
      startIndex: ai + 1,
      refPoint: a,
    });
    const lbci = findNextPointFurtherThan(stroke, {
      minDist: w / 8,
      startIndex: ci - 1,
      refPoint: c,
      direction: -1,
    });
    const { index: bi, angle: angleAbc } = findMiddlePointForMinAngle(stroke, {
      from: a,
      to: c,
      startIndex: labi,
      endIndex: lbci,
    });
    if (bi > 0 && Math.abs(180 - angleAbc) > angleThreshold) {
      const b = stroke[bi];
      if (b === undefined) {
        // Cannot happen (`bi` is a valid index), but narrows the type of `b`.
        break;
      }

      articulationPoints.push(b);
      ai = bi;
    } else {
      ai += 1;
    }
  }

  // Add the last point of the stroke.
  const last = stroke[n - 1];
  if (last !== undefined) {
    articulationPoints.push(last);
  }

  return articulationPoints;
}
