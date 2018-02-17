import rad2deg from 'rad2deg';
import getStrokeArticulationPoints from './articulation-points';
import { dist, findMaxEntry } from '../utils';
import strokeLength from './stroke-length';

/**
 * @param {Point[]} points - A list of points.
 * @return {Segment[]} The list of segments joining the points of `points`.
 */
export const pointsToSegments = points =>
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
  const item = model.getNearestChildren(segments[startIndex].angle);
  if (startIndex + 1 >= segments.length) {
    return item;
  }
  return walkMMModel(item, segments, startIndex + 1);
};

export const segmentAngle = (a, b) =>
  rad2deg(Math.atan2(b[1] - a[1], b[0] - a[0]));

/**
 * @param {{angle, length}[]} segments - A list of segments.
 * @return {{angle, length}[]} A new list of segments with the longest segments divided in two.
 */
export const divideLongestSegment = segments => {
  const [longestI, longest] = findMaxEntry(
    segments,
    (s1, s2) => s2.length - s1.length
  );
  return [
    ...segments.slice(0, longestI),
    { length: longest.length / 2, angle: longest.angle },
    { length: longest.length / 2, angle: longest.angle },
    ...segments.slice(longestI + 1)
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
  while (currentSegments.length <= maxDepth) {
    const item = walkMMModel(model, currentSegments);
    if (item && item.isLeaf()) return item;
    currentSegments = divideLongestSegment(currentSegments);
  }
  return null;
};

/**
 * @param {List.<number[]>} stroke - A list of points.
 * @param {Item} model - The marking menu model.
 * @return {Item} The item recognized by the stroke.
 */
const recognizeMMStroke = (stroke, model) => {
  const maxMenuDepth = model.getMaxDepth();
  const maxMenuBreadth = model.getMaxBreadth();
  const length = strokeLength(stroke);
  const expectedSegmentLength = length / maxMenuDepth;
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
    .map(seg => ({ points: seg, length: dist(...seg) }))
    // Remove the segments that are too small.
    .filter(seg => seg.length > minSegmentSize)
    // Change again the representation of the segment to include its length but not its
    // its points anymore.
    .map(seg =>
      Object.assign({ angle: segmentAngle(...seg.points), length: seg.length })
    );
  return findMMItem(model, segments, maxMenuDepth);
};

export default recognizeMMStroke;
