import { at } from '../utils.js';
import { validateLabelLayout } from './label-layout-validator.js';

const EPSILON = 1e-7;

type Vec2 = readonly [number, number];

/**
 A label plate to place, as measured from the rendered DOM: its item's fixed
 clockwise angle in degrees (0 = right, matching `ModelItem.angle`) and its
 rendered box size.
 */
export type LayoutPlateInput = {
  readonly angle: number;
  readonly width: number;
  readonly height: number;
};

/**
 Minimum required gaps, in pixels: between two plates (`plateHorizontal`/
 `plateVertical`), between a plate and the ring (`plateToRing`), and between
 a connector line and a plate it doesn't belong to (`plateToConnector`).
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

/**
 `optimal`: the search exhausted every candidate combination.
 `feasible`: a validated result, but the search hit its work limit before
 proving no better one exists.
 `oversized`: no valid layout exists at any shared radius; `plates` is empty.
 */
export type LayoutStatus = 'optimal' | 'feasible' | 'oversized';

export type LayoutPlateResult = {
  readonly x: number;
  readonly y: number;
  /**
  Where the connector line meets this plate, as `[x, y]` relative to the
  menu center. Always lies on the ray through the item's fixed angle.
  */
  readonly connectorContact: Vec2;
};

export type LayoutDiagnostics = {
  /**
  Search-tree nodes visited across every refinement pass.
  */
  readonly nodesExplored: number;
  /**
  Candidate pairs checked for a geometric conflict.
  */
  readonly conflictChecks: number;
};

export type LayoutResult = {
  readonly status: LayoutStatus;
  /**
  Empty iff `status === 'oversized'`. Otherwise one entry per input plate, same order.
  */
  readonly plates: readonly LayoutPlateResult[];
  readonly diagnostics: LayoutDiagnostics;
};

// -- Geometry --------------------------------------------------------------
//
// A plate is an axis-aligned box centered at (x, y), never rotated. Its
// connector is the straight segment from a fixed point on the ring
// (`start`, in the item's own angle direction) to `contact`, the point
// where a ray cast from the origin in that same fixed direction first meets
// the box. Because both ends lie on that one ray, the connector always
// points in the item's fixed direction no matter how far the box has moved
// sideways (tangentially) from it.

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

const direction = (angle: number): { readonly u: Vec2; readonly v: Vec2 } => {
  const a = radians(angle);
  return { u: [Math.cos(a), Math.sin(a)], v: [-Math.sin(a), Math.cos(a)] };
};

const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360;

type AssociationSector = {
  readonly angle: number;
  readonly before: number;
  readonly after: number;
};

type PreparedInput = {
  readonly directions: ReadonlyArray<{ readonly u: Vec2; readonly v: Vec2 }>;
  readonly starts: readonly Vec2[];
  // Undefined for a single-plate menu, where no neighbor constrains it.
  readonly sectors: ReadonlyArray<AssociationSector | undefined>;
};

/**
 Precompute each plate's fixed radial/tangential axes, its ring start point,
 and its association sector: half the angular gap to each cyclic neighbor,
 the region within which its center must stay so plates never swap places.
 */
function prepareInput(input: LayoutInput): PreparedInput {
  const directions = input.plates.map((plate) => direction(plate.angle));
  const starts: Vec2[] = directions.map(({ u }) => [
    input.ringRadius * u[0],
    input.ringRadius * u[1],
  ]);
  const sectors: Array<AssociationSector | undefined> = Array.from({
    length: input.plates.length,
  });
  if (input.plates.length >= 2) {
    const order = input.plates
      .map((plate, item) => ({ item, angle: normalizeAngle(plate.angle) }))
      .toSorted((a, b) => (a.angle === b.angle ? a.item - b.item : a.angle - b.angle));
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

/**
Distance along `ray` from the origin to where it enters `box`, or `null` if it misses.
*/
function rayBoxContact(
  center: Vec2,
  box: { readonly width: number; readonly height: number },
  ray: Vec2,
): number | null {
  const min: Vec2 = [center[0] - box.width / 2, center[1] - box.height / 2];
  const max: Vec2 = [center[0] + box.width / 2, center[1] + box.height / 2];
  let enter = 0;
  let exit = Infinity;
  for (const axis of [0, 1] as const) {
    if (Math.abs(ray[axis]) < EPSILON) {
      if (min[axis] > 0 || max[axis] < 0) {
        return null;
      }
    } else {
      const a = min[axis] / ray[axis];
      const b = max[axis] / ray[axis];
      enter = Math.max(enter, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
    }
  }

  return exit + EPSILON < enter || exit < 0 ? null : enter;
}

// A candidate plate position: one item's box at a given (radial, tangent)
// offset along its own fixed axes, with everything later checks need
// precomputed once (box bounds, connector segment bounds).
type Candidate = {
  readonly item: number;
  readonly x: number;
  readonly y: number;
  readonly radial: number;
  readonly tangent: number;
  readonly contactRadius: number;
  readonly contact: Vec2;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly connectorStartX: number;
  readonly connectorStartY: number;
  readonly connectorDeltaX: number;
  readonly connectorDeltaY: number;
  readonly connectorMinX: number;
  readonly connectorMaxX: number;
  readonly connectorMinY: number;
  readonly connectorMaxY: number;
};

/**
The interval of ray-parameter `t` (a point `t * u`) that falls inside `box`, expanded by `margin`.
*/
function rayBoxInterval(
  u: Vec2,
  box: { minX: number; maxX: number; minY: number; maxY: number },
  margin: number,
): readonly [number, number] | null {
  const minX = box.minX - margin;
  const maxX = box.maxX + margin;
  const minY = box.minY - margin;
  const maxY = box.maxY + margin;
  let enter = -Infinity;
  let exit = Infinity;
  if (Math.abs(u[0]) < EPSILON) {
    if (minX > 0 || maxX < 0) {
      return null;
    }
  } else {
    const a = minX / u[0];
    const b = maxX / u[0];
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
  }

  if (Math.abs(u[1]) < EPSILON) {
    if (minY > 0 || maxY < 0) {
      return null;
    }
  } else {
    const a = minY / u[1];
    const b = maxY / u[1];
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
  }

  return enter <= exit + EPSILON ? [enter, exit] : null;
}

/**
Whether the segment from `connector`'s start to its contact passes within `margin` of `box`.
*/
function doesConnectorHitPlate(
  connector: Candidate,
  box: { minX: number; maxX: number; minY: number; maxY: number },
  margin: number,
): boolean {
  const minX = box.minX - margin;
  const maxX = box.maxX + margin;
  const minY = box.minY - margin;
  const maxY = box.maxY + margin;
  if (
    connector.connectorMaxX < minX - EPSILON ||
    connector.connectorMinX > maxX + EPSILON ||
    connector.connectorMaxY < minY - EPSILON ||
    connector.connectorMinY > maxY + EPSILON
  ) {
    return false;
  }

  let enter = 0;
  let exit = 1;
  if (Math.abs(connector.connectorDeltaX) < EPSILON) {
    if (connector.connectorStartX < minX || connector.connectorStartX > maxX) {
      return false;
    }
  } else {
    const a = (minX - connector.connectorStartX) / connector.connectorDeltaX;
    const b = (maxX - connector.connectorStartX) / connector.connectorDeltaX;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
  }

  if (Math.abs(connector.connectorDeltaY) < EPSILON) {
    if (connector.connectorStartY < minY || connector.connectorStartY > maxY) {
      return false;
    }
  } else {
    const a = (minY - connector.connectorStartY) / connector.connectorDeltaY;
    const b = (maxY - connector.connectorStartY) / connector.connectorDeltaY;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
  }

  return enter <= exit + EPSILON;
}

/**
Whether two candidates conflict: too close, or one's connector clips the other's plate.
*/
function hasConflict(
  clearances: LayoutClearances,
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
    doesConnectorHitPlate(first, second, margin) ||
    doesConnectorHitPlate(second, first, margin)
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

function makeCandidate(
  input: LayoutInput,
  prepared: PreparedInput,
  item: number,
  radial: number,
  tangent: number,
): Candidate | null {
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

  const [startX, startY] = at(prepared.starts, item);
  const contactX = contactRadius * u[0];
  const contactY = contactRadius * u[1];
  return {
    item,
    x,
    y,
    radial,
    tangent,
    contactRadius,
    contact: [contactX, contactY],
    minX: x - plate.width / 2,
    maxX: x + plate.width / 2,
    minY: y - plate.height / 2,
    maxY: y + plate.height / 2,
    connectorStartX: startX,
    connectorStartY: startY,
    connectorDeltaX: contactX - startX,
    connectorDeltaY: contactY - startY,
    connectorMinX: Math.min(startX, contactX),
    connectorMaxX: Math.max(startX, contactX),
    connectorMinY: Math.min(startY, contactY),
    connectorMaxY: Math.max(startY, contactY),
  };
}

function isValidLayout(
  clearances: LayoutClearances,
  layout: ReadonlyArray<Candidate | null>,
): layout is readonly Candidate[] {
  const plates: Candidate[] = [];
  for (const plate of layout) {
    if (plate === null) {
      return false;
    }

    plates.push(plate);
  }

  for (let i = 0; i < plates.length; i += 1) {
    for (let j = i + 1; j < plates.length; j += 1) {
      if (hasConflict(clearances, at(plates, i), at(plates, j))) {
        return false;
      }
    }
  }

  return true;
}

// -- Objective ---------------------------------------------------------
//
// Lexicographic: compactness first (max, then total, connector-contact
// radius), then how far a plate strayed tangentially from its ideal radial
// anchor (max, then total), then how evenly plates are spread (maximize the
// smallest neighbor gap, then minimize the spread between gaps).

function neighborWhitespace(
  input: LayoutInput,
  plates: readonly Candidate[],
): readonly number[] {
  const order = input.plates
    .map((plate, item) => ({ item, angle: normalizeAngle(plate.angle) }))
    .toSorted((a, b) => a.angle - b.angle);
  return order.map((entry, index) => {
    const next = at(order, (index + 1) % order.length);
    const a = at(plates, entry.item);
    const b = at(plates, next.item);
    const pa = at(input.plates, entry.item);
    const pb = at(input.plates, next.item);
    return Math.hypot(
      Math.max(0, Math.abs(a.x - b.x) - (pa.width + pb.width) / 2),
      Math.max(0, Math.abs(a.y - b.y) - (pa.height + pb.height) / 2),
    );
  });
}

// [maxContact, totalContact, maxTangent, totalTangent, -minWhitespace, gapSpread],
// compared lexicographically, in that priority order.
type Score = readonly [number, number, number, number, number, number];

function score(input: LayoutInput, plates: readonly Candidate[]): Score {
  const contacts = plates.map((plate) => plate.contactRadius);
  const shifts = plates.map((plate) => Math.abs(plate.tangent));
  const gaps = neighborWhitespace(input, plates);
  return [
    Math.max(...contacts),
    contacts.reduce((sum, value) => sum + value, 0),
    Math.max(...shifts),
    shifts.reduce((sum, value) => sum + value, 0),
    -Math.min(...gaps),
    Math.max(...gaps) - Math.min(...gaps),
  ];
}

/**
Lexicographic compare, each element rounded to 3 decimals to ignore float noise.
*/
function compareScores(a: Score, b: Score): number {
  for (const [index, element] of a.entries()) {
    const difference = Math.round(element * 1000) - Math.round(at(b, index) * 1000);
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

// -- Shared-radius fallback ----------------------------------------------
//
// Every plate at the same shared contact radius, tangent 0. Fast, always
// correct when any layout exists, and the seed every search starts from,
// so the adaptive search can never do worse than this.

type SolveResult = {
  readonly status: LayoutStatus;
  readonly plates: readonly Candidate[];
  readonly nodesExplored: number;
  readonly conflictChecks: number;
};

function solveSharedRadius(
  input: LayoutInput,
  prepared: PreparedInput,
): SolveResult {
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
      makeCandidate(input, prepared, item, contact + halfDistance(plate), 0),
    );
    if (isValidLayout(input.clearances, plates)) {
      return {
        status: 'optimal',
        plates,
        nodesExplored: contact - first + 1,
        conflictChecks: 0,
      };
    }
  }

  return {
    status: 'oversized',
    plates: [],
    nodesExplored: cap - first + 1,
    conflictChecks: 0,
  };
}

// -- Candidate domains -----------------------------------------------------

function buildDomains(
  input: LayoutInput,
  prepared: PreparedInput,
  baseline: readonly Candidate[],
  resolution: number,
  prior?: readonly Candidate[],
): ReadonlyArray<readonly Candidate[]> {
  return input.plates.map((plate, item) => {
    const seen = new Set<string>();
    const candidates: Candidate[] = [];
    const add = (candidate: Candidate | null): void => {
      // `baseline` is a shared-radius layout, so every plate in it has the
      // same contactRadius by construction: index 0 stands for all of them.
      if (
        candidate === null ||
        candidate.contactRadius > at(baseline, 0).contactRadius + EPSILON
      ) {
        return;
      }

      const key = `${Math.round(candidate.x * 1000)},${Math.round(candidate.y * 1000)}`;
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(candidate);
      }
    };

    const base = prior?.[item];
    const { u } = at(prepared.directions, item);
    const tangentLimit =
      (plate.width / 2) * Math.abs(u[1]) + (plate.height / 2) * Math.abs(u[0]);
    if (base === undefined) {
      const min = input.ringRadius + halfDistance(plate);
      const max = at(baseline, item).radial + tangentLimit * 0.8;
      const tangentFractions = [-0.8, -0.4, 0, 0.4, 0.8];
      for (let radial = min; radial <= max; radial += resolution) {
        for (const fraction of tangentFractions) {
          add(
            makeCandidate(
              input,
              prepared,
              item,
              radial,
              tangentLimit * 0.8 * fraction,
            ),
          );
        }
      }
    } else {
      for (const dr of [-1, -0.5, 0, 0.5, 1]) {
        for (const dt of [-1, -0.5, 0, 0.5, 1]) {
          add(
            makeCandidate(
              input,
              prepared,
              item,
              base.radial + dr * resolution,
              base.tangent + dt * resolution,
            ),
          );
        }
      }
    }

    add(at(baseline, item));
    return candidates.toSorted((a, b) =>
      compareScores(
        [a.contactRadius, Math.abs(a.tangent), 0, 0, 0, 0],
        [b.contactRadius, Math.abs(b.tangent), 0, 0, 0, 0],
      ),
    );
  });
}

// -- Joint search ------------------------------------------------------
//
// Exact branch-and-bound over the Cartesian product of per-item candidate
// domains: picks the still-unassigned item with fewest remaining
// candidates, tries each in order, prunes a branch once its best-possible
// outcome can't beat the incumbent, and stops after a fixed number of tree
// nodes so the result never depends on how fast the machine is.

// A candidate tagged with a stable id for the lifetime of one `search` call,
// so per-pair conflict results can be cached in flat arrays instead of a map.
type SearchCandidate = Candidate & { readonly searchId: number };

function search(
  input: LayoutInput,
  prepared: PreparedInput,
  rawDomains: ReadonlyArray<readonly Candidate[]>,
  seed: readonly Candidate[],
  nodeLimit: number,
): SolveResult {
  const { clearances } = input;

  let nextId = 0;
  const domains: ReadonlyArray<readonly SearchCandidate[]> = rawDomains.map(
    (domain) =>
      domain.map((candidate) => ({ ...candidate, searchId: nextId++ })),
  );
  const candidateCount = nextId;

  const conflictRows: Array<Uint8Array | undefined> = Array.from({
    length: candidateCount,
  });
  let best: readonly Candidate[] = seed;
  let bestScore = score(input, best);
  const selected: Array<SearchCandidate | undefined> = Array.from({
    length: domains.length,
  });
  let nodes = 0;
  let conflictChecks = 0;
  let isStopped = false;

  const isConflicting = (
    first: SearchCandidate,
    second: SearchCandidate,
  ): boolean => {
    const low = Math.min(first.searchId, second.searchId);
    const high = Math.max(first.searchId, second.searchId);
    let row = at(conflictRows, low);
    row ??= new Uint8Array(candidateCount);
    conflictRows[low] = row;
    const cached = row[high];
    if (cached !== 0) {
      return cached === 2;
    }

    const isSeparateX =
      first.maxX + clearances.plateHorizontal <= second.minX + EPSILON ||
      second.maxX + clearances.plateHorizontal <= first.minX + EPSILON;
    const isSeparateY =
      first.maxY + clearances.plateVertical <= second.minY + EPSILON ||
      second.maxY + clearances.plateVertical <= first.minY + EPSILON;
    // Does first's connector (travelling along first's own ray) clip
    // second's box, and vice versa? `isConflicting` is itself memoized
    // above, so this only ever runs once per pair: no need to precompute
    // it for every candidate up front.
    const firstInterval = rayBoxInterval(
      at(prepared.directions, first.item).u,
      second,
      clearances.plateToConnector,
    );
    const secondInterval = rayBoxInterval(
      at(prepared.directions, second.item).u,
      first,
      clearances.plateToConnector,
    );
    const isFirstConnectorHitting =
      firstInterval !== null &&
      firstInterval[0] <= first.contactRadius + EPSILON &&
      firstInterval[1] + EPSILON >= input.ringRadius;
    const isSecondConnectorHitting =
      secondInterval !== null &&
      secondInterval[0] <= second.contactRadius + EPSILON &&
      secondInterval[1] + EPSILON >= input.ringRadius;
    const isResult =
      (!isSeparateX && !isSeparateY) ||
      isFirstConnectorHitting ||
      isSecondConnectorHitting;
    row[high] = isResult ? 2 : 1;
    return isResult;
  };

  const visit = (
    depth: number,
    availableDomains: ReadonlyArray<readonly SearchCandidate[]>,
  ): void => {
    if (nodes >= nodeLimit) {
      isStopped = true;
      return;
    }

    nodes += 1;
    if (depth === domains.length) {
      const candidateScore = score(input, selected as SearchCandidate[]);
      if (compareScores(candidateScore, bestScore) < 0) {
        best = [...selected] as SearchCandidate[];
        bestScore = candidateScore;
      }

      return;
    }

    let item = -1;
    let available: readonly SearchCandidate[] = [];
    let lowerMaxContact = 0;
    let lowerTotalContact = 0;
    for (const chosen of selected) {
      if (chosen === undefined) {
        continue;
      }

      lowerMaxContact = Math.max(lowerMaxContact, chosen.contactRadius);
      lowerTotalContact += chosen.contactRadius;
    }

    for (let index = 0; index < domains.length; index += 1) {
      if (selected[index] !== undefined) {
        continue;
      }

      const choices = at(availableDomains, index);
      if (choices.length === 0) {
        return;
      }

      let minimumContact = Infinity;
      for (const candidate of choices) {
        minimumContact = Math.min(minimumContact, candidate.contactRadius);
      }

      lowerMaxContact = Math.max(lowerMaxContact, minimumContact);
      lowerTotalContact += minimumContact;
      if (item < 0 || choices.length < available.length) {
        item = index;
        available = choices;
      }
    }

    if (
      compareScores(
        [lowerMaxContact, lowerTotalContact, 0, 0, 0, 0],
        [bestScore[0], bestScore[1], 0, 0, 0, 0],
      ) > 0
    ) {
      return;
    }

    // Narrow every still-open domain to candidates that don't conflict with
    // `candidate`, or `null` if that empties one of them. Its own function
    // so the early exit is a `return`, not a `break`/`continue` reaching
    // across the `visit` recursion's own loop nesting.
    const narrowDomains = (
      candidate: SearchCandidate,
    ): ReadonlyArray<readonly SearchCandidate[]> | null => {
      const nextDomains = [...availableDomains];
      for (let index = 0; index < domains.length; index += 1) {
        if (selected[index] !== undefined) {
          continue;
        }

        const choices: SearchCandidate[] = [];
        for (const other of at(availableDomains, index)) {
          conflictChecks += 1;
          if (!isConflicting(candidate, other)) {
            choices.push(other);
          }
        }

        if (choices.length === 0) {
          return null;
        }

        nextDomains[index] = choices;
      }

      return nextDomains;
    };

    for (const candidate of available) {
      selected[item] = candidate;
      const nextDomains = narrowDomains(candidate);
      if (nextDomains !== null) {
        visit(depth + 1, nextDomains);
      }

      selected[item] = undefined;
      if (isStopped) {
        return;
      }
    }
  };

  visit(0, domains);
  return {
    plates: best,
    nodesExplored: nodes,
    conflictChecks,
    status: isStopped ? 'feasible' : 'optimal',
  };
}

/**
Deterministic search-tree node budget: smaller as item count grows, so a solve always finishes quickly.
*/
function nodeLimitFor(count: number): number {
  if (count <= 8) {
    return 2000;
  }

  if (count <= 12) {
    return 1000;
  }

  return 75;
}

/**
 Place every label plate so it stays compact, clear of the ring and other
 plates, and inside its item's fixed direction, using strict adaptive global
 candidate search. Deterministic: the same input always produces the same
 output, and the search stops after a fixed amount of work rather than a
 time limit.

 Computing this is the caller's job to do once, from measured plate sizes,
 when a menu is created; see `createMenu`. It does not read the DOM and
 does not know how its result will be rendered.

 @param input - Fixed item angles, measured plate sizes, ring radius, and
 required clearances.
 @returns The solved layout, or an explicit `'oversized'` result with no
 plates if no valid layout exists at any shared radius.
 */
export function solveLabelLayout(input: LayoutInput): LayoutResult {
  const prepared = prepareInput(input);
  const baseline = solveSharedRadius(input, prepared);
  if (baseline.status === 'oversized') {
    return {
      status: 'oversized',
      plates: [],
      diagnostics: { nodesExplored: baseline.nodesExplored, conflictChecks: 0 },
    };
  }

  const nodeLimit = nodeLimitFor(input.plates.length);
  let domains = buildDomains(input, prepared, baseline.plates, 12);
  let result = search(input, prepared, domains, baseline.plates, nodeLimit);
  let { nodesExplored } = result;
  let { conflictChecks } = result;
  let isOptimal = result.status === 'optimal';
  for (const resolution of [4, 1]) {
    domains = buildDomains(
      input,
      prepared,
      baseline.plates,
      resolution,
      result.plates,
    );
    result = search(input, prepared, domains, result.plates, nodeLimit);
    nodesExplored += result.nodesExplored;
    conflictChecks += result.conflictChecks;
    isOptimal &&= result.status === 'optimal';
  }

  const plates = result.plates.map((plate) => ({
    x: plate.x,
    y: plate.y,
    connectorContact: plate.contact,
  }));
  const layoutResult: LayoutResult = {
    status: isOptimal ? 'optimal' : 'feasible',
    plates,
    diagnostics: { nodesExplored, conflictChecks },
  };

  const validation = validateLabelLayout(input, layoutResult);
  if (!validation.valid) {
    throw new Error(
      `Label layout solver produced an invalid layout: ${validation.failures.join('; ')}`,
    );
  }

  return layoutResult;
}
