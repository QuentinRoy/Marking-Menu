import { at, type Point } from '../../utils.js';
import type { LayoutInput, LayoutResult } from '../label-layout.js';

// Re-derives every hard constraint from scratch, independent of the
// solver's own bookkeeping, so "never return invalid geometry" is a
// checked guarantee rather than a hope.

const EPSILON = 1e-7;

export type LayoutValidation = {
  readonly valid: boolean;
  readonly failures: readonly string[];
};

const direction = (angle: number): Point => {
  const radians = (angle * Math.PI) / 180;
  return [Math.cos(radians), Math.sin(radians)];
};

const start = (input: LayoutInput, item: number): Point => {
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
  point: Point,
  center: Point,
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

type Box = {
  readonly center: Point;
  readonly halfWidth: number;
  readonly halfHeight: number;
};

function doesSegmentHitBox(from: Point, to: Point, box: Box): boolean {
  const min: Point = [
    box.center[0] - box.halfWidth,
    box.center[1] - box.halfHeight,
  ];
  const max: Point = [
    box.center[0] + box.halfWidth,
    box.center[1] + box.halfHeight,
  ];
  const delta: Point = [to[0] - from[0], to[1] - from[1]];
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

const rayError = (angle: number, point: Point): number => {
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
 Independently re-check every hard constraint of a solved layout: association
 sector via cyclic order, ring clearance, plate separation, connector
 clearance, and that every coordinate is finite.

 Two connectors can never cross each other: each lies on its own item's
 fixed ray from the origin, and `rayError` already confirms that, so no
 separate segment-intersection check is needed.

 @param input - The same input given to `solveLabelLayout`.
 @param result - Its result.
 @returns Whether every constraint holds, and a description of each one that doesn't.
 */
export function validateLabelLayout(
  input: LayoutInput,
  result: LayoutResult,
): LayoutValidation {
  const failures: string[] = [];
  if (result.oversized) {
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
      [plate.x, plate.y, ...plate.connectorContact].some(
        (value) => !Number.isFinite(value),
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
        doesSegmentHitBox(start(input, i), first.connectorContact, {
          center: [second.x, second.y],
          halfWidth: b.width / 2 + margin,
          halfHeight: b.height / 2 + margin,
        })
      ) {
        failures.push(`connector ${i} interferes with plate ${j}`);
      }

      if (
        doesSegmentHitBox(start(input, j), second.connectorContact, {
          center: [first.x, first.y],
          halfWidth: a.width / 2 + margin,
          halfHeight: a.height / 2 + margin,
        })
      ) {
        failures.push(`connector ${j} interferes with plate ${i}`);
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
