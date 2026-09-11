import { at, normalizeAngle, type EmptyTuple, type Point } from '../utils.js';

const EPSILON = 1e-7;

/**
 A label plate to place: its item's fixed clockwise angle in degrees (0 =
 right, matching `ModelItem.angle`) and its rendered box size.
 */
export type LayoutPlateInput = {
  readonly angle: number;
  readonly width: number;
  readonly height: number;
};

/**
 Minimum gaps, in pixels: between two plates (`plateHorizontal`/
 `plateVertical`), a plate and the ring (`plateToRing`), and a connector and
 a plate it doesn't belong to (`plateToConnector`).
 */
export type LayoutClearances = {
  readonly plateHorizontal: number;
  readonly plateVertical: number;
  readonly plateToRing: number;
  readonly plateToConnector: number;
};

export type LayoutInput = {
  readonly plates: readonly LayoutPlateInput[];
  readonly ringRadius: number;
  readonly clearances: LayoutClearances;
};

export type LayoutPlateResult = {
  readonly x: number;
  readonly y: number;
  /**
  Where the connector meets this plate, `[x, y]` relative to the menu center.
  */
  readonly connectorContact: Point;
};

/**
`oversized`'s `plates` is always empty: no shared radius keeps every plate clear.
*/
export type LayoutResult =
  | { readonly oversized: false; readonly plates: readonly LayoutPlateResult[] }
  | { readonly oversized: true; readonly plates: EmptyTuple };

// A plate is an axis-aligned box centered at (x, y). Its connector runs
// from a fixed point on the ring to where a ray from the origin, cast in
// the item's fixed angle, first meets the box: it always points that
// direction no matter how far the box has shifted sideways from it.

const direction = (angle: number): { readonly u: Point; readonly v: Point } => {
  const a = (angle * Math.PI) / 180;
  return { u: [Math.cos(a), Math.sin(a)], v: [-Math.sin(a), Math.cos(a)] };
};

type AssociationSector = {
  readonly angle: number;
  readonly before: number;
  readonly after: number;
};

type PreparedInput = {
  readonly directions: ReadonlyArray<{ readonly u: Point; readonly v: Point }>;
  readonly starts: readonly Point[];
  // Undefined for a single-plate menu, where no neighbor constrains it.
  readonly sectors: ReadonlyArray<AssociationSector | undefined>;
};

// Precompute each plate's fixed radial/tangential axes, ring start point,
// and association sector (half the angular gap to each cyclic neighbor:
// the region its center must stay in so plates never swap places).
function prepareInput(input: LayoutInput): PreparedInput {
  const directions = input.plates.map((plate) => direction(plate.angle));
  const starts: Point[] = directions.map(({ u }) => [
    input.ringRadius * u[0],
    input.ringRadius * u[1],
  ]);
  const sectors: Array<AssociationSector | undefined> = Array.from({
    length: input.plates.length,
  });
  if (input.plates.length >= 2) {
    const order = input.plates
      .map((plate, item) => ({ item, angle: normalizeAngle(plate.angle) }))
      .toSorted((a, b) =>
        a.angle === b.angle ? a.item - b.item : a.angle - b.angle,
      );
    for (const [index, entry] of order.entries()) {
      const previous = at(order, (index - 1 + order.length) % order.length);
      const next = at(order, (index + 1) % order.length);
      sectors[entry.item] = {
        angle: entry.angle,
        before: normalizeAngle(entry.angle - previous.angle) / 2,
        after: normalizeAngle(next.angle - entry.angle) / 2,
      };
    }
  }

  return { directions, starts, sectors };
}

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

type Box = {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
};

/**
The interval of `t` where `origin + t * delta` lies inside `box`, or `null` if it never does.
*/
function clipToBox(
  origin: Point,
  delta: Point,
  box: Box,
): readonly [number, number] | null {
  let enter = -Infinity;
  let exit = Infinity;
  for (const [o, d, min, max] of [
    [origin[0], delta[0], box.minX, box.maxX],
    [origin[1], delta[1], box.minY, box.maxY],
  ] as const) {
    if (Math.abs(d) < EPSILON) {
      if (o < min || o > max) {
        return null;
      }
    } else {
      const a = (min - o) / d;
      const b = (max - o) / d;
      enter = Math.max(enter, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
    }
  }

  return enter <= exit + EPSILON ? [enter, exit] : null;
}

/**
Distance along unit `ray` from the origin to where it enters `box`, or `null` if it misses (behind the origin, or never).
*/
function rayBoxContact(
  center: Point,
  box: { readonly width: number; readonly height: number },
  ray: Point,
): number | null {
  const interval = clipToBox([0, 0], ray, {
    minX: center[0] - box.width / 2,
    maxX: center[0] + box.width / 2,
    minY: center[1] - box.height / 2,
    maxY: center[1] + box.height / 2,
  });
  return interval === null || interval[1] < 0 ? null : Math.max(interval[0], 0);
}

/**
Whether the segment from `start` to `end` passes within `margin` of `box`.
*/
function doesSegmentHitBox(
  start: Point,
  end: Point,
  box: Box,
  margin: number,
): boolean {
  const interval = clipToBox(start, [end[0] - start[0], end[1] - start[1]], {
    minX: box.minX - margin,
    maxX: box.maxX + margin,
    minY: box.minY - margin,
    maxY: box.maxY + margin,
  });
  return (
    interval !== null && interval[0] <= 1 + EPSILON && interval[1] >= -EPSILON
  );
}

// A plate at a given (radial, tangent) offset along its own fixed axes.
type Candidate = {
  readonly item: number;
  readonly x: number;
  readonly y: number;
  readonly radial: number;
  readonly tangent: number;
  readonly contactRadius: number;
  readonly contact: Point;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
};

/**
Whether two candidates conflict: too close, or one's connector clips the other's plate.
*/
function hasConflict(
  clearances: LayoutClearances,
  starts: readonly Point[],
  first: Candidate,
  second: Candidate,
): boolean {
  const isSeparateX =
    first.maxX + clearances.plateHorizontal <= second.minX + EPSILON ||
    second.maxX + clearances.plateHorizontal <= first.minX + EPSILON;
  const isSeparateY =
    first.maxY + clearances.plateVertical <= second.minY + EPSILON ||
    second.maxY + clearances.plateVertical <= first.minY + EPSILON;
  if (!isSeparateX && !isSeparateY) {
    return true;
  }

  const margin = clearances.plateToConnector;
  return (
    doesSegmentHitBox(at(starts, first.item), first.contact, second, margin) ||
    doesSegmentHitBox(at(starts, second.item), second.contact, first, margin)
  );
}

/**
A box's radial half-thickness along its own ray: how far its near edge sits behind its center.
*/
function halfDistance(plate: LayoutPlateInput): number {
  const { u } = direction(plate.angle);
  return Math.min(
    Math.abs(u[0]) < EPSILON ? Infinity : plate.width / 2 / Math.abs(u[0]),
    Math.abs(u[1]) < EPSILON ? Infinity : plate.height / 2 / Math.abs(u[1]),
  );
}

function isInsideAssociationSector(
  sector: AssociationSector | undefined,
  x: number,
  y: number,
): boolean {
  if (sector === undefined) {
    return true;
  }

  const centerAngle = normalizeAngle((Math.atan2(y, x) * 180) / Math.PI);
  const delta = ((centerAngle - sector.angle + 540) % 360) - 180;
  return delta >= -sector.before - EPSILON && delta <= sector.after + EPSILON;
}

// Place plate `item` at the given offset, or `null` if that leaves its
// association sector, or lets the plate or connector enter the ring.
function makeCandidate(
  input: LayoutInput,
  prepared: PreparedInput,
  item: number,
  offset: { readonly radial: number; readonly tangent: number },
): Candidate | null {
  const { radial, tangent } = offset;
  const plate = at(input.plates, item);
  const { u, v } = at(prepared.directions, item);
  const x = radial * u[0] + tangent * v[0];
  const y = radial * u[1] + tangent * v[1];
  const contactRadius = rayBoxContact([x, y], plate, u);
  if (
    contactRadius === null ||
    contactRadius < input.ringRadius ||
    !isInsideAssociationSector(prepared.sectors[item], x, y) ||
    distanceToBox(x, y, plate.width, plate.height) <
      input.ringRadius + input.clearances.plateToRing - EPSILON
  ) {
    return null;
  }

  return {
    item,
    x,
    y,
    radial,
    tangent,
    contactRadius,
    contact: [contactRadius * u[0], contactRadius * u[1]],
    minX: x - plate.width / 2,
    maxX: x + plate.width / 2,
    minY: y - plate.height / 2,
    maxY: y + plate.height / 2,
  };
}

function isValidLayout(
  clearances: LayoutClearances,
  starts: readonly Point[],
  layout: readonly Candidate[],
): boolean {
  for (let i = 0; i < layout.length; i += 1) {
    for (let j = i + 1; j < layout.length; j += 1) {
      if (hasConflict(clearances, starts, at(layout, i), at(layout, j))) {
        return false;
      }
    }
  }

  return true;
}

// Quality is lexicographic and smaller is better: compactness first (max,
// then total, connector-contact radius), then how far a plate strayed
// tangentially from its ideal radial anchor (max, then total).
type Quality = readonly [number, number, number, number];

function quality(plates: readonly Candidate[]): Quality {
  const contacts = plates.map((plate) => plate.contactRadius);
  const shifts = plates.map((plate) => Math.abs(plate.tangent));
  return [
    Math.max(...contacts),
    contacts.reduce((sum, value) => sum + value, 0),
    Math.max(...shifts),
    shifts.reduce((sum, value) => sum + value, 0),
  ];
}

/**
Whether `next` is a real improvement over `previous`, each rounded to 3 decimals to ignore float noise.
*/
function isBetter(next: Quality, previous: Quality): boolean {
  for (const [index, element] of next.entries()) {
    const difference =
      Math.round(element * 1000) - Math.round(at(previous, index) * 1000);
    if (difference !== 0) {
      return difference < 0;
    }
  }

  return false;
}

/**
 Step 1: every plate at the same shared contact radius, tangent 0, scanned
 one pixel at a time outward from the ring. The fastest layout that is
 correct whenever any layout exists at all.
 */
function solveSharedRadius(
  input: LayoutInput,
  prepared: PreparedInput,
): readonly Candidate[] | null {
  const first = Math.ceil(input.ringRadius + input.clearances.plateToRing);
  // Any configuration the model's minimum angular gap allows can be made
  // conflict-free by a radius this large: every plate's own diagonal is
  // enough slack to clear both the ring and every other plate.
  const cap =
    first +
    input.plates.reduce(
      (sum, plate) => sum + Math.hypot(plate.width, plate.height),
      0,
    );
  for (let contact = first; contact <= cap; contact += 1) {
    const plates = input.plates.map((plate, item) =>
      makeCandidate(input, prepared, item, {
        radial: contact + halfDistance(plate),
        tangent: 0,
      }),
    );
    if (
      plates.every((plate) => plate !== null) &&
      isValidLayout(input.clearances, prepared.starts, plates)
    ) {
      return plates;
    }
  }

  return null;
}

// Steps 2-4: repeatedly nudge each plate inward (radial) or sideways
// (tangent), inside its association sector. Keep a move only when the
// whole layout stays valid and its quality improves. Step size shrinks
// once a full pass finds no more improving move at the current size.
const STEP_SIZES = [16, 8, 4, 2, 1];

type Move = {
  readonly plates: readonly Candidate[];
  readonly quality: Quality;
};

type MoveSearch = {
  readonly item: number;
  readonly step: number;
  readonly best: Quality;
};

/**
Try nudging plate `item` inward or sideways by `step`; the best resulting layout that improves on `best`, or `null`.
*/
function bestMoveFor(
  input: LayoutInput,
  prepared: PreparedInput,
  plates: readonly Candidate[],
  { item, step, best }: MoveSearch,
): Move | null {
  const plate = at(plates, item);
  const offsets = [
    { radial: plate.radial - step, tangent: plate.tangent },
    { radial: plate.radial, tangent: plate.tangent + step },
    { radial: plate.radial, tangent: plate.tangent - step },
  ];
  let found: Move | null = null;
  for (const offset of offsets) {
    const candidate = makeCandidate(input, prepared, item, offset);
    if (candidate === null) {
      continue;
    }

    const attempt = plates.map((current, index) =>
      index === item ? candidate : current,
    );
    if (!isValidLayout(input.clearances, prepared.starts, attempt)) {
      continue;
    }

    const attemptQuality = quality(attempt);
    if (isBetter(attemptQuality, found?.quality ?? best)) {
      found = { plates: attempt, quality: attemptQuality };
    }
  }

  return found;
}

function compact(
  input: LayoutInput,
  prepared: PreparedInput,
  seed: readonly Candidate[],
): readonly Candidate[] {
  let plates = seed;
  let best = quality(plates);
  for (const step of STEP_SIZES) {
    let isImproved = true;
    while (isImproved) {
      isImproved = false;
      for (const item of plates.keys()) {
        const found = bestMoveFor(input, prepared, plates, {
          item,
          step,
          best,
        });
        if (found !== null) {
          plates = found.plates;
          best = found.quality;
          isImproved = true;
        }
      }
    }
  }

  return plates;
}

/**
 Place every label plate compact, clear of the ring and other plates, and
 inside its item's fixed direction: a shared-radius layout, then
 deterministic greedy compaction. The same input always produces the same
 output. Called once per menu creation; see `createMenu`.
 */
export function solveLabelLayout(input: LayoutInput): LayoutResult {
  const prepared = prepareInput(input);
  const baseline = solveSharedRadius(input, prepared);
  if (baseline === null) {
    return { oversized: true, plates: [] };
  }

  const plates = compact(input, prepared, baseline);
  return {
    oversized: false,
    plates: plates.map((plate) => ({
      x: plate.x,
      y: plate.y,
      connectorContact: plate.contact,
    })),
  };
}
