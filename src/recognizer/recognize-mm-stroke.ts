import type { AnyModelNode, ModelNodes } from '../types.js';
import {
  dist,
  findMaxEntry,
  radiansToDegrees,
  type NonEmptyArray,
  type Point,
  type Segment,
} from '../utils.js';
import { getStrokeArticulationPoints } from './articulation-points.js';
import { strokeLength } from './stroke-length.js';

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
 The implementation of {@link walkModel}, loosely typed over the erased
 {@link AnyModelNode}: the precise type is re-attached once, in `walkModel`
 itself. Recursing generically over `N` instead would require the compiler to
 unfold `ModelNodes<N>` — a recursively defined conditional type — across a
 generic call, which it cannot do (see `walkModel`'s own cast).
 */
const walkModelLoose = (
  model: AnyModelNode,
  segments: Array<{ angle: number }>,
  startIndex: number,
): NonEmptyArray<AnyModelNode> | null => {
  const segment = segments[startIndex];
  if (segment === undefined || model.isLeaf) {
    return null;
  }

  const item = model.getNearestChild(segment.angle);
  if (item === null) {
    return null;
  }

  if (startIndex + 1 >= segments.length) {
    return [item];
  }

  const rest = walkModelLoose(item, segments, startIndex + 1);
  return rest === null ? null : [item, ...rest];
};

/**
 Walk the marking menu model along a list of segments.

 @param options - Configuration options.
 @param options.model - The marking menu model.
 @param options.segments - A list of segments to walk the model.
 @param options.startIndex - The start index in the angle list.
 @returns The path walked down the model, from the item the first segment
 lands on to the one the last segment lands on, or `null` if the segments do
 not lead to an item. `model` itself is not part of the path, which is hence
 never empty.
 */
export const walkModel = <N extends AnyModelNode>({
  model,
  segments,
  startIndex = 0,
}: {
  model: N;
  segments: Array<{ angle: number }>;
  startIndex?: number;
}): NonEmptyArray<ModelNodes<N>> | null =>
  // Sound by construction: `AnyModelNode`'s polymorphic `this` ties a node's
  // children to its own item type, so every node `walkModelLoose` visits is
  // genuinely a member of `ModelNodes<N>` for the concrete `N` it was called
  // with. The compiler just cannot verify this through a generic recursive
  // walk, hence the single assertion here rather than scattered through the
  // recursion.
  walkModelLoose(model, segments, startIndex) as NonEmptyArray<
    ModelNodes<N>
  > | null;

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
 The implementation of {@link findItem}, loosely typed for the same reason as
 {@link walkModelLoose}.
 */
const findItemLoose = (
  model: AnyModelNode,
  segments: StrokeSegment[],
  maxDepth: number,
): NonEmptyArray<AnyModelNode> | null => {
  // If there is not segments, there is no selection to find.
  if (segments.length === 0) {
    return null;
  }

  // While we haven't found a leaf item, divide the longest segment and walk the model.
  let currentSegments = segments;
  let currentPath: NonEmptyArray<AnyModelNode> | null = null;
  while (currentSegments.length <= maxDepth) {
    currentPath = walkModelLoose(model, currentSegments, 0);
    if (currentPath?.at(-1)?.isLeaf) {
      return currentPath;
    }

    currentSegments = divideLongestSegment(currentSegments);
  }

  return currentPath;
};

/**
 Find the item selected by a list of segments, dividing the longest segment and walking the
 model until a leaf is found or `maxDepth` is reached.

 @param options - Configuration options.
 @param options.model - The marking menu model.
 @param options.segments - A list of segments.
 @param options.maxDepth - The maximum depth of the item.
 @returns The path leading to the selected item (see {@link walkModel}).
 */
export const findItem = <N extends AnyModelNode>({
  model,
  segments,
  maxDepth = model.getMaxDepth(),
}: {
  model: N;
  segments: StrokeSegment[];
  maxDepth?: number;
}): NonEmptyArray<ModelNodes<N>> | null =>
  // Sound by construction, same rationale as `walkModel`'s cast.
  findItemLoose(model, segments, maxDepth) as NonEmptyArray<
    ModelNodes<N>
  > | null;

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
export function recognizeMarkingMenuStroke<N extends AnyModelNode>(
  stroke: Point[],
  model: N,
  {
    maxDepth: maxDepthOption = model.getMaxDepth(),
    requireMenu = false,
    requireLeaf = !requireMenu,
  }: {
    maxDepth?: number;
    requireMenu?: boolean;
    requireLeaf?: boolean;
  } = {},
): ModelNodes<N> | null {
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
  const path = findItem({ model, segments, maxDepth });
  // Paths are never empty, so the item is only nullish when the path is.
  const item = path?.at(-1) ?? null;
  if (requireLeaf) {
    return item?.isLeaf ? item : null;
  }

  if (requireMenu) {
    if (item?.isLeaf) {
      // The menu holding the leaf is the item the walk visited just before it.
      // A leaf can only ever be the last item of a path — the walk stops on a
      // leaf model — so this is the leaf's own parent menu, and `model` itself
      // when the leaf was found at the first level. `N` is trivially a member
      // of `ModelNodes<N>` (its own base case); the cast is only needed
      // because the compiler does not unfold the conditional for generic `N`.
      return path?.at(-2) ?? (model as ModelNodes<N>);
    }

    return item;
  }

  return item;
}
