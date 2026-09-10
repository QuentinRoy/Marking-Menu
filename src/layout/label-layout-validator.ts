import { at } from '../utils.js';
import type { LayoutInput, LayoutResult } from './label-layout.js';

const EPSILON = 1e-7;

export type LayoutValidation = {
  readonly valid: boolean;
  readonly failures: readonly string[];
};

type Vec2 = readonly [number, number];

const direction = (angle: number): Vec2 => {
  const radians = (angle * Math.PI) / 180;
  return [Math.cos(radians), Math.sin(radians)];
};

const start = (input: LayoutInput, item: number): Vec2 => {
  const [ux, uy] = direction(at(input.plates, item).angle);
  return [input.ringRadius * ux, input.ringRadius * uy];
};

const distanceToBox = (
  x: number,
  y: number,
  width: number,
  height: number,
): number =>
  Math.hypot(
    Math.max(0, Math.abs(x) - width / 2),
    Math.max(0, Math.abs(y) - height / 2),
  );

const isPointOnBoxBoundary = (
  point: Vec2,
  center: Vec2,
  width: number,
  height: number,
): boolean => {
  const x = Math.abs(point[0] - center[0]);
  const y = Math.abs(point[1] - center[1]);
  const isOnVertical =
    Math.abs(x - width / 2) <= EPSILON && y <= height / 2 + EPSILON;
  const isOnHorizontal =
    Math.abs(y - height / 2) <= EPSILON && x <= width / 2 + EPSILON;
  return isOnVertical || isOnHorizontal;
};

function doesSegmentHitBox(
  from: Vec2,
  to: Vec2,
  center: Vec2,
  halfWidth: number,
  halfHeight: number,
): boolean {
  const min: Vec2 = [center[0] - halfWidth, center[1] - halfHeight];
  const max: Vec2 = [center[0] + halfWidth, center[1] + halfHeight];
  const delta: Vec2 = [to[0] - from[0], to[1] - from[1]];
  let enter = 0;
  let exit = 1;
  for (const axis of [0, 1] as const) {
    if (Math.abs(delta[axis]) <= EPSILON) {
      if (
        from[axis] < min[axis] - EPSILON ||
        from[axis] > max[axis] + EPSILON
      ) {
        return false;
      }
    } else {
      const first = (min[axis] - from[axis]) / delta[axis];
      const second = (max[axis] - from[axis]) / delta[axis];
      enter = Math.max(enter, Math.min(first, second));
      exit = Math.min(exit, Math.max(first, second));
    }
  }

  return enter <= exit + EPSILON;
}

const cross = (a: Vec2, b: Vec2, c: Vec2): number =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

const isOnSegment = (a: Vec2, b: Vec2, point: Vec2): boolean =>
  Math.abs(cross(a, b, point)) <= EPSILON &&
  point[0] >= Math.min(a[0], b[0]) - EPSILON &&
  point[0] <= Math.max(a[0], b[0]) + EPSILON &&
  point[1] >= Math.min(a[1], b[1]) - EPSILON &&
  point[1] <= Math.max(a[1], b[1]) + EPSILON;

function areSegmentsIntersecting(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  if (
    ((abC > EPSILON && abD < -EPSILON) || (abC < -EPSILON && abD > EPSILON)) &&
    ((cdA > EPSILON && cdB < -EPSILON) || (cdA < -EPSILON && cdB > EPSILON))
  ) {
    return true;
  }

  return (
    (Math.abs(abC) <= EPSILON && isOnSegment(a, b, c)) ||
    (Math.abs(abD) <= EPSILON && isOnSegment(a, b, d)) ||
    (Math.abs(cdA) <= EPSILON && isOnSegment(c, d, a)) ||
    (Math.abs(cdB) <= EPSILON && isOnSegment(c, d, b))
  );
}

const rayError = (angle: number, point: Vec2): number => {
  const [ux, uy] = direction(angle);
  return Math.abs(point[0] * uy - point[1] * ux);
};

function isSameCycle(
  expected: readonly number[],
  actual: readonly number[],
): boolean {
  if (expected.length !== actual.length) {
    return false;
  }

  for (let offset = 0; offset < expected.length; offset += 1) {
    if (
      expected.every(
        (item, index) => item === actual[(index + offset) % actual.length],
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 Re-derive every hard constraint from scratch, independent of the solver's
 own bookkeeping: association sector via cyclic order, ring clearance,
 plate separation, connector clearance, and that every coordinate is
 finite. This is what makes "never return invalid geometry" a checked
 guarantee rather than a hope.

 @param input - The same input given to `solveLabelLayout`.
 @param result - Its result.
 @returns Whether every constraint holds, and a description of each one that doesn't.
 */
export function validateLabelLayout(
  input: LayoutInput,
  result: LayoutResult,
): LayoutValidation {
  const failures: string[] = [];
  if (result.status === 'oversized') {
    return { valid: true, failures };
  }

  if (result.plates.length !== input.plates.length) {
    failures.push('plate count differs from input');
  }

  for (const [item, plate] of result.plates.entries()) {
    const source = input.plates[item];
    if (source === undefined) {
      continue;
    }

    if (
      [plate.x, plate.y, ...plate.connectorContact].some((value) =>
        !Number.isFinite(value),
      )
    ) {
      failures.push(`plate ${item} has a non-finite coordinate`);
    }

    if (rayError(source.angle, plate.connectorContact) > 0.001) {
      failures.push(`connector ${item} left its fixed direction`);
    }

    const [ux, uy] = direction(source.angle);
    if (
      plate.connectorContact[0] * ux + plate.connectorContact[1] * uy <
      input.ringRadius - EPSILON
    ) {
      failures.push(`connector ${item} points into the ring`);
    }

    if (
      !isPointOnBoxBoundary(
        plate.connectorContact,
        [plate.x, plate.y],
        source.width,
        source.height,
      )
    ) {
      failures.push(`connector ${item} misses its plate`);
    }

    if (
      distanceToBox(plate.x, plate.y, source.width, source.height) <
      input.ringRadius + input.clearances.plateToRing - 0.001
    ) {
      failures.push(`plate ${item} enters the ring clearance`);
    }
  }

  for (let i = 0; i < result.plates.length; i += 1) {
    for (let j = i + 1; j < result.plates.length; j += 1) {
      const first = at(result.plates, i);
      const second = at(result.plates, j);
      const a = at(input.plates, i);
      const b = at(input.plates, j);
      const isSeparateX =
        Math.abs(first.x - second.x) + EPSILON >=
        (a.width + b.width) / 2 + input.clearances.plateHorizontal;
      const isSeparateY =
        Math.abs(first.y - second.y) + EPSILON >=
        (a.height + b.height) / 2 + input.clearances.plateVertical;
      if (!isSeparateX && !isSeparateY) {
        failures.push(`plates ${i} and ${j} overlap`);
      }

      const margin = input.clearances.plateToConnector;
      if (
        doesSegmentHitBox(
          start(input, i),
          first.connectorContact,
          [second.x, second.y],
          b.width / 2 + margin,
          b.height / 2 + margin,
        )
      ) {
        failures.push(`connector ${i} interferes with plate ${j}`);
      }

      if (
        doesSegmentHitBox(
          start(input, j),
          second.connectorContact,
          [first.x, first.y],
          a.width / 2 + margin,
          a.height / 2 + margin,
        )
      ) {
        failures.push(`connector ${j} interferes with plate ${i}`);
      }

      if (
        areSegmentsIntersecting(
          start(input, i),
          first.connectorContact,
          start(input, j),
          second.connectorContact,
        )
      ) {
        failures.push(`connectors ${i} and ${j} cross`);
      }
    }
  }

  const expectedOrder = input.plates
    .map((plate, item) => ({ item, angle: ((plate.angle % 360) + 360) % 360 }))
    .toSorted((a, b) => a.angle - b.angle)
    .map(({ item }) => item);
  const actualOrder = result.plates
    .map((plate, item) => ({
      item,
      angle: (Math.atan2(plate.y, plate.x) + Math.PI * 2) % (Math.PI * 2),
    }))
    .toSorted((a, b) => a.angle - b.angle)
    .map(({ item }) => item);
  if (!isSameCycle(expectedOrder, actualOrder)) {
    failures.push('plate centers change the cyclic item order');
  }

  return { valid: failures.length === 0, failures };
}
