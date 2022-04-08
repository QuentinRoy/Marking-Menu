import getStrokeArticulationPoints from './articulation-points';
import { dist, findMaxEntry, radiansToDegrees } from '../utils';
import strokeLength from './stroke-length';

/**
 * @param {Point[]} points - A list of points.
 * @return {Segment[]} The list of segments joining the points of `points`.
 */
export const pointsToSegments = (points) =>
  points.slice(1).reduce(
    ({ segments, last }, current) => {
      segments.push([last, current]);
      return { segments, last: current };
    },
    { last: points[0], segments: [] }
  ).segments;

/**
 * @param {Item} model - The marking menu model.
 * @param {{ angle }[]} segments - A list of segments to walk the model.
 * @param {number} [startIndex=0] - The start index in the angle list.
 * @return {Item} The corresponding item found by walking the model.
 */
export const walkMMModel = (model, segments, startIndex = 0) => {
  if (!model || segments.length === 0 || model.isLeaf()) return null;
  const item = model.getNearestChild(segments[startIndex].angle);
  if (startIndex + 1 >= segments.length) {
    return item;
  }
  return walkMMModel(item, segments, startIndex + 1);
};

export const segmentAngle = (a, b) =>
  radiansToDegrees(Math.atan2(b[1] - a[1], b[0] - a[0]));

/**
 * @param {{angle, length}[]} segments - A list of segments.
 * @return {{angle, length}[]} A new list of segments with the longest segments divided in two.
 */
export const divideLongestSegment = (segments) => {
  const [longestI, longest] = findMaxEntry(
    segments,
    (s1, s2) => s2.length - s1.length
  );
  return [
    ...segments.slice(0, longestI),
    { length: longest.length / 2, angle: longest.angle },
    { length: longest.length / 2, angle: longest.angle },
    ...segments.slice(longestI + 1),
  ];
};

/**
 * @param {Item} model - The marking menu model.
 * @param {{length, angle}[]} segments - A list of segments.
 * @param {number} [maxDepth=model.getMaxDepth()] - The maximum depth of the item.
 * @return {Item} The selected item.
 */
export const findMMItem = (model, segments, maxDepth = model.getMaxDepth()) => {
  // If there is not segments, there is no selection to find.
  if (!segments.length) return null;
  // While we haven't found a leaf item, divide the longest segment and walk the model.
  let currentSegments = segments;
  let currentItem = null;
  while (currentSegments.length <= maxDepth) {
    currentItem = walkMMModel(model, currentSegments);
    if (currentItem && currentItem.isLeaf()) return currentItem;
    currentSegments = divideLongestSegment(currentSegments);
  }
  return currentItem;
};

/**
 * @param {List.<number[]>} stroke - A list of points.
 * @param {Item} model - The marking menu model.
 * @param {object} [options] - Additional options.
 * @param {number} [maxDepth] - The maximum menu depth to walk. If negative,
 * start from the maximum depth of the model.
 * @param {boolean} [requireMenu=false] - Look for a menu item. This
 * works best with a negative value for maxDepth.
 * @param {boolean} [requireLeaf=!requireMenu] - Look for a leaf.
 * @return {Item} The item recognized by the stroke.
 */
const recognizeMMStroke = (
  stroke,
  model,
  {
    maxDepth: maxDepth_ = model.getMaxDepth(),
    requireMenu = false,
    requireLeaf = !requireMenu,
  } = {}
) => {
  if (requireLeaf && requireMenu) {
    throw new Error('The result cannot be both a leaf and a menu');
  }
  const maxDepth = maxDepth_ < 0 ? model.getMaxDepth() + maxDepth_ : maxDepth_;
  const maxMenuBreadth = model.getMaxBreadth();
  const length = strokeLength(stroke);
  const expectedSegmentLength = length / maxDepth;
  const sensitivity = 0.75;
  const angleThreshold = 360 / maxMenuBreadth / 2 / sensitivity;
  const articulationPoints = getStrokeArticulationPoints(
    stroke,
    expectedSegmentLength,
    angleThreshold
  );
  const minSegmentSize = expectedSegmentLength / 3;
  // Get the segments of the marking menus.
  const segments = pointsToSegments(articulationPoints)
    // Change the representation of the segment to include its length.
    .map((seg) => ({ points: seg, length: dist(...seg) }))
    // Remove the segments that are too small.
    .filter((seg) => seg.length > minSegmentSize)
    // Change again the representation of the segment to include its length but not its
    // its points anymore.
    .map((seg) => ({ angle: segmentAngle(...seg.points), length: seg.length }));
  const item = findMMItem(model, segments, maxDepth);
  if (requireLeaf) {
    return item && item.isLeaf() ? item : null;
  }
  if (requireMenu) {
    return item && item.isLeaf() ? item.parent : item;
  }
  return item;
};

export default recognizeMMStroke;
