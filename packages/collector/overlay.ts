import type { RecordedEvent } from './model.js';

type Point = { x: number; y: number };

function item<T>(values: T[], index: number): T {
  const value = values[index];
  if (value === undefined) {
    throw new RangeError(`Missing array item ${index}`);
  }

  return value;
}

function cell(rows: number[][], row: number, column: number): number {
  return item(item(rows, row), column);
}

function setCell(
  rows: number[][],
  row: number,
  column: number,
  value: number,
): void {
  item(rows, row)[column] = value;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function direction(angle: number): Point {
  const radians = (angle * Math.PI) / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function segmentCost(
  points: Point[],
  from: number,
  to: number,
  angle: number,
): number {
  const vector = direction(angle);
  const start = points[from];
  if (!start) {
    return Infinity;
  }
  let cost = 0;
  for (let index = from + 1; index <= to; index++) {
    const point = points[index];
    if (!point) {
      continue;
    }
    const cross =
      (point.x - start.x) * vector.y - (point.y - start.y) * vector.x;
    cost += cross * cross;
  }

  return cost / Math.max(1, to - from);
}

function articulationIndices(points: Point[], angles: number[]): number[] {
  const count = points.length;
  if (angles.length === 1 || count < angles.length + 1) {
    return [];
  }
  const cost = Array.from({ length: angles.length }, () =>
    Array.from({ length: count }, () => Infinity),
  );
  const previous = Array.from({ length: angles.length }, () =>
    Array.from({ length: count }, () => 0),
  );
  for (let end = 1; end < count; end++) {
    setCell(cost, 0, end, segmentCost(points, 0, end, item(angles, 0)));
  }

  for (let level = 1; level < angles.length; level++) {
    for (let end = level + 1; end < count; end++) {
      for (let start = level; start < end; start++) {
        const value =
          cell(cost, level - 1, start) +
          segmentCost(points, start, end, item(angles, level));
        if (value >= cell(cost, level, end)) {
          continue;
        }

        setCell(cost, level, end, value);
        setCell(previous, level, end, start);
      }
    }
  }

  const indices: number[] = [];
  let end = count - 1;
  for (let level = angles.length - 1; level > 0; level--) {
    end = cell(previous, level, end);
    indices.unshift(end);
  }

  return indices;
}

function solve(matrix: number[][], vector: number[]): number[] {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, item(vector, index)]);
  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) {
      if (
        Math.abs(cell(augmented, row, column)) >
        Math.abs(cell(augmented, pivot, column))
      ) {
        pivot = row;
      }
    }

    const pivotRow = item(augmented, pivot);
    augmented[pivot] = item(augmented, column);
    augmented[column] = pivotRow;
    const divisor = cell(augmented, column, column);
    if (Math.abs(divisor) < 1e-9) {
      continue;
    }
    for (let entry = column; entry <= size; entry++) {
      setCell(
        augmented,
        column,
        entry,
        cell(augmented, column, entry) / divisor,
      );
    }

    for (let row = 0; row < size; row++) {
      if (row === column) {
        continue;
      }
      const factor = cell(augmented, row, column);
      for (let entry = column; entry <= size; entry++) {
        setCell(
          augmented,
          row,
          entry,
          cell(augmented, row, entry) - factor * cell(augmented, column, entry),
        );
      }
    }
  }

  return augmented.map((row) => item(row, size));
}

export function fitOverlay(events: RecordedEvent[], angles: number[]): Point[] {
  const raw = events.filter(
    (event) => !event.coalesced && event.type !== 'pointercancel',
  );
  if (raw.length < 2 || angles.length === 0) {
    return [];
  }
  const points = raw
    .filter(
      (_, index) => index % Math.max(1, Math.floor(raw.length / 80)) === 0,
    )
    .map(({ x, y }) => ({ x, y }));
  const end = raw.at(-1);
  if (end && distance(item(points, points.length - 1), end) > 0) {
    points.push({ x: end.x, y: end.y });
  }

  const start = points[0];
  if (!start) {
    return [];
  }
  const corners = articulationIndices(points, angles);
  const observations = [
    ...corners.map((index) => item(points, index)),
    item(points, points.length - 1),
  ];
  const vectors = angles.map((angle) => direction(angle));
  const size = angles.length;
  const matrix = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 0),
  );
  const rhs = Array.from({ length: size }, () => 0);
  for (const [index, point] of observations.entries()) {
    const weight = index === observations.length - 1 ? 1 : 10;
    for (let first = 0; first <= index; first++) {
      const a = vectors[first];
      if (!a) {
        continue;
      }
      rhs[first] =
        item(rhs, first) +
        weight * (a.x * (point.x - start.x) + a.y * (point.y - start.y));
      for (let second = 0; second <= index; second++) {
        const b = vectors[second];
        if (b) {
          setCell(
            matrix,
            first,
            second,
            cell(matrix, first, second) + weight * (a.x * b.x + a.y * b.y),
          );
        }
      }
    }
  }

  for (let index = 0; index < size; index++) {
    setCell(matrix, index, index, cell(matrix, index, index) + 1e-6);
  }

  const lengths = solve(matrix, rhs).map((length) => Math.max(0, length));
  const overlay = [start];
  for (const [index, vector] of vectors.entries()) {
    const last = item(overlay, overlay.length - 1);
    overlay.push({
      x: last.x + vector.x * item(lengths, index),
      y: last.y + vector.y * item(lengths, index),
    });
  }

  return overlay;
}

export function strokeLength(events: RecordedEvent[]): number {
  const points = events.filter((event) => !event.coalesced);
  return points
    .slice(1)
    .reduce(
      (length, point, index) => length + distance(item(points, index), point),
      0,
    );
}
