import { dist, findMaxEntry, radiansToDegrees } from '../utils.js';
import type { Point, Segment, MarkingMenuModelItem } from '../types.js';
import getStrokeArticulationPoints from './articulation-points.js';
import strokeLength from './stroke-length.js';

/**
 A segment of a marking-menu stroke, described by its length and angle.
 */
type StrokeSegment = {
  length: number;
  angle: number;
};

/**
 Join the consecutive points of `points` into segments.

 @param points - A list of points.
 @returns The list of segments joining the points of `points`.
 */
export const pointsToSegments = (points: Point[]): Segment[] => {
  const [first, ...rest] = points;
  if (first === undefined) {
    return [];
  }

  const segments: Segment[] = [];
  let last = first;
  for (const current of rest) {
    segments.push([last, current]);
    last = current;
  }

  return segments;
};

/**
 Walk the marking menu model along a list of segments.

 @param options - Configuration options.
 @param options.model - The marking menu model.
 @param options.segments - A list of segments to walk the model.
 @param options.startIndex - The start index in the angle list.
 @returns The corresponding item found by walking the model.
 */
export const walkModel = <M extends MarkingMenuModelItem>({
  model,
  segments,
  startIndex = 0,
}: {
  model: M;
  segments: Array<{ angle: number }>;
  startIndex?: number;
}): M | null => {
  const segment = segments[startIndex];
  if (segment === undefined || model.isLeaf()) {
    return null;
  }

  // `getNearestChild` returns an item of the model's own type in practice
  // (MarkingMenuItem in production, mock items in tests), hence the assertion.
  const item = model.getNearestChild(segment.angle) as M | null;
  if (item === null) {
    return null;
  }

  if (startIndex + 1 >= segments.length) {
    return item;
  }

  return walkModel({ model: item, segments, startIndex: startIndex + 1 });
};

export const segmentAngle = (a: Point, b: Point): number =>
  radiansToDegrees(Math.atan2(b[1] - a[1], b[0] - a[0]));

/**
 Divide the longest segment of a list of segments in two.

 @param segments - A list of segments.
 @returns A new list of segments with the longest segments divided in two.
 */
export const divideLongestSegment = (
  segments: StrokeSegment[],
): StrokeSegment[] => {
  const [longestI, longest] = findMaxEntry(
    segments,
    (s1, s2) => s2.length - s1.length,
  );
  if (longest === undefined) {
    // Only possible for an empty segment list.
    return [];
  }

  return [
    ...segments.slice(0, longestI),
    { length: longest.length / 2, angle: longest.angle },
    { length: longest.length / 2, angle: longest.angle },
    ...segments.slice(longestI + 1),
  ];
};

/**
 Find the item selected by a list of segments, dividing the longest segment and walking the
 model until a leaf is found or `maxDepth` is reached.

 @param options - Configuration options.
 @param options.model - The marking menu model.
 @param options.segments - A list of segments.
 @param options.maxDepth - The maximum depth of the item.
 @returns The selected item.
 */
export const findItem = <M extends MarkingMenuModelItem>({
  model,
  segments,
  maxDepth = model.getMaxDepth(),
}: {
  model: M;
  segments: StrokeSegment[];
  maxDepth?: number;
}): M | null => {
  // If there is not segments, there is no selection to find.
  if (segments.length === 0) {
    return null;
  }

  // While we haven't found a leaf item, divide the longest segment and walk the model.
  let currentSegments = segments;
  let currentItem: M | null = null;
  while (currentSegments.length <= maxDepth) {
    currentItem = walkModel({ model, segments: currentSegments });
    if (currentItem?.isLeaf()) {
      return currentItem;
    }

    currentSegments = divideLongestSegment(currentSegments);
  }

  return currentItem;
};

/**
 Recognize the item selected by a marking menu stroke.

 @param stroke - A list of points.
 @param model - The model to recognize the stroke against.
 @param options - Additional options.
 @param options.maxDepth - The maximum menu depth to walk. If negative,
 start from the maximum depth of the model.
 @param options.requireMenu - Look for a menu item. This
 works best with a negative value for maxDepth.
 @param options.requireLeaf - Look for a leaf.
 @returns The item recognized by the stroke.
 */
export default function recognizeMarkingMenuStroke<
  M extends MarkingMenuModelItem,
>(
  stroke: Point[],
  model: M,
  {
    maxDepth: maxDepthOption = model.getMaxDepth(),
    requireMenu = false,
    requireLeaf = !requireMenu,
  }: {
    maxDepth?: number;
    requireMenu?: boolean;
    requireLeaf?: boolean;
  } = {},
): M | null {
  if (requireLeaf && requireMenu) {
    throw new Error('The result cannot be both a leaf and a menu');
  }

  const maxDepth =
    maxDepthOption < 0 ? model.getMaxDepth() + maxDepthOption : maxDepthOption;
  const maxMenuBreadth = model.getMaxBreadth();
  const length = strokeLength(stroke);
  const expectedSegmentLength = length / maxDepth;
  const sensitivity = 0.75;
  const angleThreshold = 360 / maxMenuBreadth / 2 / sensitivity;
  const articulationPoints = getStrokeArticulationPoints(stroke, {
    expectedSegmentLength,
    angleThreshold,
  });
  const minSegmentSize = expectedSegmentLength / 3;
  // Get the segments of the marking menus.
  const segments = pointsToSegments(articulationPoints)
    // Change the representation of the segment to include its length.
    .map((seg) => ({ points: seg, length: dist(...seg) }))
    // Remove the segments that are too small.
    .filter((seg) => seg.length > minSegmentSize)
    // Change again the representation of the segment to include its length but not its
    // its points anymore.
    .map((seg) => ({
      angle: segmentAngle(...seg.points),
      length: seg.length,
    }));
  const item = findItem({ model, segments, maxDepth });
  if (requireLeaf) {
    return item?.isLeaf() ? item : null;
  }

  if (requireMenu) {
    if (item?.isLeaf()) {
      // A leaf found by walking the model always has a parent: the walk
      // returns null for a leaf model, so it cannot be the root. The parent
      // has the model's own type, hence the assertion.
      return (item.parent ?? null) as M | null;
    }

    return item;
  }

  return item;
}
