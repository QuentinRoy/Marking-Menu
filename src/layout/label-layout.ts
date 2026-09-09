/**
 Deterministic geometry for the plates and connectors of one static menu.

 The solver treats each item's angle as fixed. It first constructs a
 collision-free shared-radius layout, then searches finite radial and
 tangential candidate positions for the complete menu jointly. Search is
 bounded by a deterministic node count, never by elapsed time.
 */

export type LabelPlateInput = {
  readonly angle: number;
  readonly width: number;
  readonly height: number;
};

export type LabelLayoutInput = {
  readonly plates: readonly LabelPlateInput[];
  readonly ringRadius: number;
  readonly clearances: {
    readonly plateHorizontal: number;
    readonly plateVertical: number;
    readonly plateToRing: number;
    readonly plateToConnector: number;
  };
  /**
   A deterministic limit on explored search states. The default is intended
   for menu creation; tests and the comparison prototype may override it.
   */
  readonly searchNodeLimit?: number | undefined;
};

export type LabelLayoutPlate = {
  readonly x: number;
  readonly y: number;
  readonly connectorContact: readonly [number, number];
};

export type LabelLayoutMetrics = {
  readonly maxContactRadius: number;
  readonly totalContactRadius: number;
  readonly maxTangentialDisplacement: number;
  readonly totalTangentialDisplacement: number;
  readonly minimumNeighborWhitespace: number;
  readonly neighborWhitespaceVariation: number;
  readonly nearEdgeExtent: number;
  readonly outerExtent: number;
  readonly visualCentroidOffset: number;
};

export type LabelLayoutDiagnostics = {
  readonly candidateCount: number;
  readonly conflictCount: number;
  readonly exploredNodes: number;
  readonly candidateResolution: number;
  readonly refinementConverged: boolean;
  readonly finiteCandidateOptimal: boolean;
  readonly metrics: LabelLayoutMetrics;
};

export type LabelLayoutResult =
  | {
      readonly status: 'optimal' | 'feasible' | 'fallback';
      readonly plates: readonly LabelLayoutPlate[];
      readonly diagnostics: LabelLayoutDiagnostics;
    }
  | {
      readonly status: 'oversized';
      readonly plates: readonly LabelLayoutPlate[];
      readonly reason: string;
    };

type Point = readonly [number, number];

type Candidate = {
  readonly item: number;
  readonly x: number;
  readonly y: number;
  readonly radialCenter: number;
  readonly tangential: number;
  readonly contact: Point;
  readonly contactRadius: number;
  globalIndex: number;
};

type SearchResult = {
  readonly assignment: readonly Candidate[];
  readonly exploredNodes: number;
  readonly conflictCount: number;
  readonly complete: boolean;
};

type AngularBound = { readonly before: number; readonly after: number };

type CandidateOptions = {
  readonly input: LabelLayoutInput;
  readonly item: number;
  readonly radialCenter: number;
  readonly tangential: number;
  readonly bounds: readonly AngularBound[];
};

type Box = {
  readonly center: Point;
  readonly halfWidth: number;
  readonly halfHeight: number;
};

const EPSILON = 1e-7;
const SCORE_SCALE = 1000;
const MAX_LAYOUT_EXTENT = 4096;
const DEFAULT_NODE_LIMIT = 250_000;
const INITIAL_RESOLUTION = 12;
const REFINEMENT_RESOLUTIONS = [4, 1] as const;

const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const normalizeDegrees = (degrees: number): number => {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const positiveAngleDifference = (from: number, to: number): number =>
  normalizeDegrees(to - from);

const signedAngleDifference = (from: number, to: number): number => {
  const difference = positiveAngleDifference(from, to);
  return difference > 180 ? difference - 360 : difference;
};

const quantize = (value: number): number => Math.round(value * SCORE_SCALE);

function assertInput(input: LabelLayoutInput): void {
  const values = [
    input.ringRadius,
    input.clearances.plateHorizontal,
    input.clearances.plateVertical,
    input.clearances.plateToRing,
    input.clearances.plateToConnector,
    ...input.plates.flatMap((plate) => [
      plate.angle,
      plate.width,
      plate.height,
    ]),
  ];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new TypeError('Label layout geometry must contain finite numbers.');
  }

  if (
    input.ringRadius < 0 ||
    input.clearances.plateHorizontal < 0 ||
    input.clearances.plateVertical < 0 ||
    input.clearances.plateToRing < 0 ||
    input.clearances.plateToConnector < 0 ||
    input.plates.some((plate) => plate.width < 0 || plate.height < 0)
  ) {
    throw new RangeError(
      'Label layout dimensions and clearances must be nonnegative.',
    );
  }

  const normalizedAngles = input.plates
    .map((plate) => normalizeDegrees(plate.angle))
    .toSorted((a, b) => a - b);
  for (let index = 1; index < normalizedAngles.length; index += 1) {
    const previous = normalizedAngles[index - 1];
    const current = normalizedAngles[index];
    if (
      previous !== undefined &&
      current !== undefined &&
      Math.abs(current - previous) < EPSILON
    ) {
      throw new RangeError('Label layout angles must be distinct.');
    }
  }

  if (
    input.searchNodeLimit !== undefined &&
    (!Number.isSafeInteger(input.searchNodeLimit) || input.searchNodeLimit <= 0)
  ) {
    throw new RangeError(
      'The label layout search node limit must be a positive integer.',
    );
  }
}

function direction(angle: number): { readonly u: Point; readonly v: Point } {
  const radians = degreesToRadians(angle);
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return { u: [cosine, sine], v: [-sine, cosine] };
}

function distanceFromOriginToBox(
  x: number,
  y: number,
  halfWidth: number,
  halfHeight: number,
): number {
  const dx = Math.max(0, Math.abs(x) - halfWidth);
  const dy = Math.max(0, Math.abs(y) - halfHeight);
  return Math.hypot(dx, dy);
}

function rayBoxContactRadius(
  center: Point,
  plate: LabelPlateInput,
  ray: Point,
): number | null {
  const minimum = [
    center[0] - plate.width / 2,
    center[1] - plate.height / 2,
  ] as const;
  const maximum = [
    center[0] + plate.width / 2,
    center[1] + plate.height / 2,
  ] as const;
  let entrance = 0;
  let exit = Infinity;

  for (const axis of [0, 1] as const) {
    const component = ray[axis];
    if (Math.abs(component) < EPSILON) {
      if (minimum[axis] > 0 || maximum[axis] < 0) {
        return null;
      }

      continue;
    }

    const first = minimum[axis] / component;
    const second = maximum[axis] / component;
    entrance = Math.max(entrance, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
  }

  return exit + EPSILON < entrance || exit < 0 ? null : entrance;
}

function doesSegmentHitBox(start: Point, end: Point, box: Box): boolean {
  const minimum = [
    box.center[0] - box.halfWidth,
    box.center[1] - box.halfHeight,
  ] as const;
  const maximum = [
    box.center[0] + box.halfWidth,
    box.center[1] + box.halfHeight,
  ] as const;
  const delta = [end[0] - start[0], end[1] - start[1]] as const;
  let entrance = 0;
  let exit = 1;

  for (const axis of [0, 1] as const) {
    const component = delta[axis];
    if (Math.abs(component) < EPSILON) {
      if (start[axis] < minimum[axis] || start[axis] > maximum[axis]) {
        return false;
      }

      continue;
    }

    const first = (minimum[axis] - start[axis]) / component;
    const second = (maximum[axis] - start[axis]) / component;
    entrance = Math.max(entrance, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
  }

  return entrance <= exit + EPSILON;
}

function pointToSegmentDistance(
  point: Point,
  start: Point,
  end: Point,
): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < EPSILON) {
    return Math.hypot(point[0] - start[0], point[1] - start[1]);
  }

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared,
    ),
  );
  return Math.hypot(
    point[0] - (start[0] + projection * dx),
    point[1] - (start[1] + projection * dy),
  );
}

function orientation(a: Point, b: Point, c: Point): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function doesPointLieOnSegment(
  point: Point,
  start: Point,
  end: Point,
): boolean {
  return (
    point[0] >= Math.min(start[0], end[0]) - EPSILON &&
    point[0] <= Math.max(start[0], end[0]) + EPSILON &&
    point[1] >= Math.min(start[1], end[1]) - EPSILON &&
    point[1] <= Math.max(start[1], end[1]) + EPSILON
  );
}

function doesSegmentsIntersect(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
): boolean {
  const first = orientation(a, b, c);
  const second = orientation(a, b, d);
  const third = orientation(c, d, a);
  const fourth = orientation(c, d, b);
  if (first * second < -EPSILON && third * fourth < -EPSILON) {
    return true;
  }

  return (
    (Math.abs(first) <= EPSILON && doesPointLieOnSegment(c, a, b)) ||
    (Math.abs(second) <= EPSILON && doesPointLieOnSegment(d, a, b)) ||
    (Math.abs(third) <= EPSILON && doesPointLieOnSegment(a, c, d)) ||
    (Math.abs(fourth) <= EPSILON && doesPointLieOnSegment(b, c, d))
  );
}

function segmentDistance(a: Point, b: Point, c: Point, d: Point): number {
  if (doesSegmentsIntersect(a, b, c, d)) {
    return 0;
  }

  return Math.min(
    pointToSegmentDistance(a, c, d),
    pointToSegmentDistance(b, c, d),
    pointToSegmentDistance(c, a, b),
    pointToSegmentDistance(d, a, b),
  );
}

function angularBounds(
  plates: readonly LabelPlateInput[],
): readonly AngularBound[] {
  if (plates.length < 2) {
    return plates.map(() => ({ before: 180, after: 180 }));
  }

  const order = plates
    .map((plate, item) => ({ angle: normalizeDegrees(plate.angle), item }))
    .toSorted((a, b) => a.angle - b.angle);
  const bounds = plates.map(() => ({ before: 0, after: 0 }));
  for (let position = 0; position < order.length; position += 1) {
    const current = order[position];
    const previous = order[(position - 1 + order.length) % order.length];
    const next = order[(position + 1) % order.length];
    if (current === undefined || previous === undefined || next === undefined) {
      continue;
    }

    bounds[current.item] = {
      before: positiveAngleDifference(previous.angle, current.angle) / 2,
      after: positiveAngleDifference(current.angle, next.angle) / 2,
    };
  }

  return bounds;
}

function makeCandidate({
  input,
  item,
  radialCenter,
  tangential,
  bounds,
}: CandidateOptions): Candidate | null {
  const plate = input.plates[item];
  const bound = bounds[item];
  if (plate === undefined || bound === undefined) {
    return null;
  }

  const { u, v } = direction(plate.angle);
  const center = [
    radialCenter * u[0] + tangential * v[0],
    radialCenter * u[1] + tangential * v[1],
  ] as const;
  const outerExtent = Math.max(
    ...[
      [center[0] - plate.width / 2, center[1] - plate.height / 2],
      [center[0] + plate.width / 2, center[1] - plate.height / 2],
      [center[0] - plate.width / 2, center[1] + plate.height / 2],
      [center[0] + plate.width / 2, center[1] + plate.height / 2],
    ].map(([x, y]) => Math.hypot(x ?? 0, y ?? 0)),
  );
  const contactRadius = rayBoxContactRadius(center, plate, u);
  if (
    contactRadius === null ||
    contactRadius < input.ringRadius - EPSILON ||
    outerExtent > MAX_LAYOUT_EXTENT + EPSILON ||
    distanceFromOriginToBox(
      center[0],
      center[1],
      plate.width / 2,
      plate.height / 2,
    ) <
      input.ringRadius + input.clearances.plateToRing - EPSILON
  ) {
    return null;
  }

  const centerAngle = normalizeDegrees(
    (Math.atan2(center[1], center[0]) * 180) / Math.PI,
  );
  const displacement = signedAngleDifference(
    normalizeDegrees(plate.angle),
    centerAngle,
  );
  if (
    displacement < -bound.before - EPSILON ||
    displacement > bound.after + EPSILON
  ) {
    return null;
  }

  return {
    item,
    x: center[0],
    y: center[1],
    radialCenter,
    tangential,
    contact: [contactRadius * u[0], contactRadius * u[1]],
    contactRadius,
    globalIndex: -1,
  };
}

function connectorStart(input: LabelLayoutInput, item: number): Point {
  const plate = input.plates[item];
  if (plate === undefined) {
    return [0, 0];
  }

  const { u } = direction(plate.angle);
  return [input.ringRadius * u[0], input.ringRadius * u[1]];
}

function doesCandidatesConflict(
  input: LabelLayoutInput,
  first: Candidate,
  second: Candidate,
): boolean {
  const firstPlate = input.plates[first.item];
  const secondPlate = input.plates[second.item];
  if (firstPlate === undefined || secondPlate === undefined) {
    return true;
  }

  const isSeparatedHorizontally =
    Math.abs(first.x - second.x) + EPSILON >=
    firstPlate.width / 2 +
      secondPlate.width / 2 +
      input.clearances.plateHorizontal;
  const isSeparatedVertically =
    Math.abs(first.y - second.y) + EPSILON >=
    firstPlate.height / 2 +
      secondPlate.height / 2 +
      input.clearances.plateVertical;
  if (!isSeparatedHorizontally && !isSeparatedVertically) {
    return true;
  }

  const connectorMargin = input.clearances.plateToConnector;
  if (
    doesSegmentHitBox(connectorStart(input, first.item), first.contact, {
      center: [second.x, second.y],
      halfWidth: secondPlate.width / 2 + connectorMargin,
      halfHeight: secondPlate.height / 2 + connectorMargin,
    }) ||
    doesSegmentHitBox(connectorStart(input, second.item), second.contact, {
      center: [first.x, first.y],
      halfWidth: firstPlate.width / 2 + connectorMargin,
      halfHeight: firstPlate.height / 2 + connectorMargin,
    })
  ) {
    return true;
  }

  return (
    segmentDistance(
      connectorStart(input, first.item),
      first.contact,
      connectorStart(input, second.item),
      second.contact,
    ) +
      EPSILON <
    connectorMargin
  );
}

function centeredHalfDistance(plate: LabelPlateInput): number {
  const { u } = direction(plate.angle);
  const horizontal =
    Math.abs(u[0]) < EPSILON ? Infinity : plate.width / 2 / Math.abs(u[0]);
  const vertical =
    Math.abs(u[1]) < EPSILON ? Infinity : plate.height / 2 / Math.abs(u[1]);
  return Math.min(horizontal, vertical);
}

function sharedRadiusLayout(
  input: LabelLayoutInput,
  bounds: readonly AngularBound[],
): readonly Candidate[] | null {
  const floor = Math.ceil(input.ringRadius + input.clearances.plateToRing);
  for (let contact = floor; contact <= MAX_LAYOUT_EXTENT; contact += 1) {
    const layout = input.plates.map((plate, item) =>
      makeCandidate({
        input,
        item,
        radialCenter: contact + centeredHalfDistance(plate),
        tangential: 0,
        bounds,
      }),
    );
    if (layout.includes(null)) {
      continue;
    }

    const candidates = layout.filter(
      (candidate): candidate is Candidate => candidate !== null,
    );
    if (isCandidateLayoutValid(input, candidates)) {
      return candidates;
    }
  }

  return null;
}

function isCandidateLayoutValid(
  input: LabelLayoutInput,
  layout: readonly Candidate[],
): boolean {
  for (const [firstIndex, first] of layout.entries()) {
    for (const second of layout.slice(firstIndex + 1)) {
      if (doesCandidatesConflict(input, first, second)) {
        return false;
      }
    }
  }

  return true;
}

function tangentialLimit(plate: LabelPlateInput): number {
  const { u } = direction(plate.angle);
  return (
    (plate.width / 2) * Math.abs(u[1]) + (plate.height / 2) * Math.abs(u[0])
  );
}

function candidateKey(candidate: Candidate): string {
  return `${quantize(candidate.x)},${quantize(candidate.y)}`;
}

function addCandidate(
  domain: Candidate[],
  seen: Set<string>,
  candidate: Candidate | null,
  maximumContact: number,
): void {
  if (
    candidate === null ||
    candidate.contactRadius > maximumContact + EPSILON
  ) {
    return;
  }

  const key = candidateKey(candidate);
  if (!seen.has(key)) {
    seen.add(key);
    domain.push(candidate);
  }
}

function initialDomains(
  input: LabelLayoutInput,
  baseline: readonly Candidate[],
  bounds: ReadonlyArray<{ readonly before: number; readonly after: number }>,
): Candidate[][] {
  const maximumContact = Math.max(
    ...baseline.map((candidate) => candidate.contactRadius),
  );
  return input.plates.map((plate, item) => {
    const domain: Candidate[] = [];
    const seen = new Set<string>();
    const baselineCandidate = baseline[item];
    if (baselineCandidate === undefined) {
      return domain;
    }

    const limit = tangentialLimit(plate) * 0.8;
    const minimumCenter = input.ringRadius + centeredHalfDistance(plate);
    const maximumCenter = baselineCandidate.radialCenter + limit;
    for (
      let radialCenter = minimumCenter;
      radialCenter <= maximumCenter + EPSILON;
      radialCenter += INITIAL_RESOLUTION
    ) {
      for (const fraction of [-0.8, -0.4, 0, 0.4, 0.8]) {
        addCandidate(
          domain,
          seen,
          makeCandidate({
            input,
            item,
            radialCenter,
            tangential: limit * fraction,
            bounds,
          }),
          maximumContact,
        );
      }
    }

    addCandidate(domain, seen, baselineCandidate, maximumContact);
    return domain.toSorted(compareCandidate);
  });
}

function refineDomains({
  input,
  domains,
  selected,
  bounds,
  resolution,
}: {
  readonly input: LabelLayoutInput;
  readonly domains: Candidate[][];
  readonly selected: readonly Candidate[];
  readonly bounds: readonly AngularBound[];
  readonly resolution: number;
}): void {
  const maximumContact = Math.max(
    ...selected.map((candidate) => candidate.contactRadius),
  );
  for (const [item, domain] of domains.entries()) {
    const center = selected[item];
    if (domain === undefined || center === undefined) {
      continue;
    }

    const seen = new Set(domain.map((candidate) => candidateKey(candidate)));
    for (const radialStep of [-1, -0.5, 0, 0.5, 1]) {
      for (const tangentialStep of [-1, -0.5, 0, 0.5, 1]) {
        addCandidate(
          domain,
          seen,
          makeCandidate({
            input,
            item,
            radialCenter: center.radialCenter + radialStep * resolution,
            tangential: center.tangential + tangentialStep * resolution,
            bounds,
          }),
          maximumContact,
        );
      }
    }

    domains[item] = domain.toSorted(compareCandidate);
  }
}

function compareCandidate(first: Candidate, second: Candidate): number {
  const comparisons = [
    quantize(first.contactRadius) - quantize(second.contactRadius),
    quantize(Math.abs(first.tangential)) -
      quantize(Math.abs(second.tangential)),
    quantize(first.radialCenter) - quantize(second.radialCenter),
    quantize(first.tangential) - quantize(second.tangential),
  ];
  return comparisons.find((comparison) => comparison !== 0) ?? 0;
}

function rectangleWhitespace(
  first: Candidate,
  firstPlate: LabelPlateInput,
  second: Candidate,
  secondPlate: LabelPlateInput,
): number {
  const dx = Math.max(
    0,
    Math.abs(first.x - second.x) - (firstPlate.width + secondPlate.width) / 2,
  );
  const dy = Math.max(
    0,
    Math.abs(first.y - second.y) - (firstPlate.height + secondPlate.height) / 2,
  );
  return Math.hypot(dx, dy);
}

function orderedNeighborWhitespace(
  input: LabelLayoutInput,
  assignment: readonly Candidate[],
): readonly number[] {
  if (assignment.length < 2) {
    return [];
  }

  const order = input.plates
    .map((plate, item) => ({ angle: normalizeDegrees(plate.angle), item }))
    .toSorted((a, b) => a.angle - b.angle);
  const whitespace: number[] = [];
  for (let index = 0; index < order.length; index += 1) {
    const firstItem = order[index]?.item;
    const secondItem = order[(index + 1) % order.length]?.item;
    if (firstItem === undefined || secondItem === undefined) {
      continue;
    }

    const first = assignment[firstItem];
    const second = assignment[secondItem];
    const firstPlate = input.plates[firstItem];
    const secondPlate = input.plates[secondItem];
    if (
      first !== undefined &&
      second !== undefined &&
      firstPlate !== undefined &&
      secondPlate !== undefined
    ) {
      whitespace.push(
        rectangleWhitespace(first, firstPlate, second, secondPlate),
      );
    }
  }

  return whitespace;
}

function score(
  input: LabelLayoutInput,
  assignment: readonly Candidate[],
): readonly number[] {
  const contacts = assignment.map((candidate) =>
    quantize(candidate.contactRadius),
  );
  const shifts = assignment.map((candidate) =>
    quantize(Math.abs(candidate.tangential)),
  );
  const whitespace = orderedNeighborWhitespace(input, assignment).map((value) =>
    quantize(value),
  );
  const minimumWhitespace =
    whitespace.length === 0 ? 0 : Math.min(...whitespace);
  const whitespaceVariation =
    whitespace.length === 0 ? 0 : Math.max(...whitespace) - minimumWhitespace;
  return [
    contacts.length === 0 ? 0 : Math.max(...contacts),
    contacts.reduce((sum, value) => sum + value, 0),
    shifts.length === 0 ? 0 : Math.max(...shifts),
    shifts.reduce((sum, value) => sum + value, 0),
    -minimumWhitespace,
    whitespaceVariation,
    ...assignment.map((candidate) => candidate.globalIndex),
  ];
}

function compareScores(
  first: readonly number[],
  second: readonly number[],
): number {
  const length = Math.max(first.length, second.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (first[index] ?? 0) - (second[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function search(
  input: LabelLayoutInput,
  domains: Candidate[][],
  seed: readonly Candidate[],
  nodeLimit: number,
): SearchResult {
  let totalCandidates = 0;
  for (const domain of domains) {
    for (const candidate of domain) {
      candidate.globalIndex = totalCandidates;
      totalCandidates += 1;
    }
  }

  const { conflicts, conflictCount } = buildConflictMatrix(
    input,
    domains,
    totalCandidates,
  );
  const seedByItem = seed.map((candidate, item) => {
    const match = domains[item]?.find(
      (available) => candidateKey(available) === candidateKey(candidate),
    );
    return match ?? candidate;
  });
  let best = [...seedByItem];
  let bestScore = score(input, best);
  const selected = Array.from<Candidate | undefined>({
    length: domains.length,
  });
  let exploredNodes = 0;
  let isExhausted = false;

  const isCompatible = (candidate: Candidate): boolean => {
    for (const chosen of selected) {
      if (
        chosen !== undefined &&
        conflicts[
          candidate.globalIndex * totalCandidates + chosen.globalIndex
        ] === 1
      ) {
        return false;
      }
    }

    return true;
  };

  const visit = (depth: number): void => {
    if (exploredNodes >= nodeLimit) {
      isExhausted = true;
      return;
    }

    exploredNodes += 1;
    if (depth === domains.length) {
      const assignment = selected.filter(
        (candidate): candidate is Candidate => candidate !== undefined,
      );
      const candidateScore = score(input, assignment);
      if (compareScores(candidateScore, bestScore) < 0) {
        best = [...assignment];
        bestScore = candidateScore;
      }

      return;
    }

    let branchItem = -1;
    let branchDomain: Candidate[] = [];
    const minimumContacts: number[] = [];
    const minimumShifts: number[] = [];
    for (const [item, domain] of domains.entries()) {
      if (selected[item] !== undefined) {
        continue;
      }

      const compatible = domain.filter((candidate) => isCompatible(candidate));
      if (compatible.length === 0) {
        return;
      }

      minimumContacts.push(
        Math.min(
          ...compatible.map((candidate) => quantize(candidate.contactRadius)),
        ),
      );
      minimumShifts.push(
        Math.min(
          ...compatible.map((candidate) =>
            quantize(Math.abs(candidate.tangential)),
          ),
        ),
      );
      if (branchItem === -1 || compatible.length < branchDomain.length) {
        branchItem = item;
        branchDomain = compatible;
      }
    }

    const chosen = selected.filter(
      (candidate): candidate is Candidate => candidate !== undefined,
    );
    const chosenContacts = chosen.map((candidate) =>
      quantize(candidate.contactRadius),
    );
    const chosenShifts = chosen.map((candidate) =>
      quantize(Math.abs(candidate.tangential)),
    );
    const lowerBound = [
      Math.max(0, ...chosenContacts, ...minimumContacts),
      chosenContacts.reduce((sum, value) => sum + value, 0) +
        minimumContacts.reduce((sum, value) => sum + value, 0),
      Math.max(0, ...chosenShifts, ...minimumShifts),
      chosenShifts.reduce((sum, value) => sum + value, 0) +
        minimumShifts.reduce((sum, value) => sum + value, 0),
    ];
    if (compareScores(lowerBound, bestScore.slice(0, 4)) > 0) {
      return;
    }

    if (branchItem < 0) {
      return;
    }

    for (const candidate of branchDomain) {
      selected[branchItem] = candidate;
      visit(depth + 1);
      selected[branchItem] = undefined;
      if (isExhausted) {
        return;
      }
    }
  };

  visit(0);
  return {
    assignment: best,
    exploredNodes,
    conflictCount,
    complete: !isExhausted,
  };
}

function buildConflictMatrix(
  input: LabelLayoutInput,
  domains: readonly Candidate[][],
  totalCandidates: number,
): { readonly conflicts: Uint8Array; readonly conflictCount: number } {
  const conflicts = new Uint8Array(totalCandidates * totalCandidates);
  let conflictCount = 0;
  for (const [firstItem, firstDomain] of domains.entries()) {
    for (const secondDomain of domains.slice(firstItem + 1)) {
      for (const first of firstDomain) {
        for (const second of secondDomain) {
          conflictCount += recordConflict({
            input,
            conflicts,
            totalCandidates,
            first,
            second,
          });
        }
      }
    }
  }

  return { conflicts, conflictCount };
}

function recordConflict({
  input,
  conflicts,
  totalCandidates,
  first,
  second,
}: {
  readonly input: LabelLayoutInput;
  readonly conflicts: Uint8Array;
  readonly totalCandidates: number;
  readonly first: Candidate;
  readonly second: Candidate;
}): number {
  if (!doesCandidatesConflict(input, first, second)) {
    return 0;
  }

  conflicts[first.globalIndex * totalCandidates + second.globalIndex] = 1;
  conflicts[second.globalIndex * totalCandidates + first.globalIndex] = 1;
  return 1;
}

function layoutMetrics(
  input: LabelLayoutInput,
  assignment: readonly Candidate[],
): LabelLayoutMetrics {
  if (assignment.length === 0) {
    return {
      maxContactRadius: 0,
      totalContactRadius: 0,
      maxTangentialDisplacement: 0,
      totalTangentialDisplacement: 0,
      minimumNeighborWhitespace: 0,
      neighborWhitespaceVariation: 0,
      nearEdgeExtent: 0,
      outerExtent: 0,
      visualCentroidOffset: 0,
    };
  }

  const contacts = assignment.map((candidate) => candidate.contactRadius);
  const shifts = assignment.map((candidate) => Math.abs(candidate.tangential));
  const whitespace = orderedNeighborWhitespace(input, assignment);
  let nearEdgeExtent = 0;
  let outerExtent = 0;
  let weightedX = 0;
  let weightedY = 0;
  let totalArea = 0;
  for (const [item, candidate] of assignment.entries()) {
    const plate = input.plates[item];
    if (candidate === undefined || plate === undefined) {
      continue;
    }

    nearEdgeExtent = Math.max(
      nearEdgeExtent,
      distanceFromOriginToBox(
        candidate.x,
        candidate.y,
        plate.width / 2,
        plate.height / 2,
      ),
    );
    for (const x of [
      candidate.x - plate.width / 2,
      candidate.x + plate.width / 2,
    ]) {
      for (const y of [
        candidate.y - plate.height / 2,
        candidate.y + plate.height / 2,
      ]) {
        outerExtent = Math.max(outerExtent, Math.hypot(x, y));
      }
    }

    const area = plate.width * plate.height;
    weightedX += candidate.x * area;
    weightedY += candidate.y * area;
    totalArea += area;
  }

  const minimumWhitespace =
    whitespace.length === 0 ? 0 : Math.min(...whitespace);
  return {
    maxContactRadius: Math.max(...contacts),
    totalContactRadius: contacts.reduce((sum, value) => sum + value, 0),
    maxTangentialDisplacement: Math.max(...shifts),
    totalTangentialDisplacement: shifts.reduce((sum, value) => sum + value, 0),
    minimumNeighborWhitespace: minimumWhitespace,
    neighborWhitespaceVariation:
      whitespace.length === 0 ? 0 : Math.max(...whitespace) - minimumWhitespace,
    nearEdgeExtent,
    outerExtent,
    visualCentroidOffset:
      totalArea === 0
        ? 0
        : Math.hypot(weightedX / totalArea, weightedY / totalArea),
  };
}

/**
 Lay out a complete menu from measured plate boxes.

 `optimal` means the search proved the best lexicographic result in the final
 finite candidate sets. `feasible` means the deterministic node limit stopped
 the proof and the returned incumbent passed every constraint. `fallback`
 reserves the valid shared-radius answer for a candidate-search failure.
 */
export function solveLabelLayout(input: LabelLayoutInput): LabelLayoutResult {
  assertInput(input);
  if (input.plates.length === 0) {
    return {
      status: 'optimal',
      plates: [],
      diagnostics: {
        candidateCount: 0,
        conflictCount: 0,
        exploredNodes: 0,
        candidateResolution: 1,
        refinementConverged: true,
        finiteCandidateOptimal: true,
        metrics: layoutMetrics(input, []),
      },
    };
  }

  const bounds = angularBounds(input.plates);
  const baseline = sharedRadiusLayout(input, bounds);
  if (baseline === null) {
    return {
      status: 'oversized',
      plates: [],
      reason: `No valid layout was found within ${MAX_LAYOUT_EXTENT}px of the menu center.`,
    };
  }

  const nodeLimit = input.searchNodeLimit ?? DEFAULT_NODE_LIMIT;
  const domains = initialDomains(input, baseline, bounds);
  if (domains.some((domain) => domain.length === 0)) {
    const metrics = layoutMetrics(input, baseline);
    return {
      status: 'fallback',
      plates: baseline.map((candidate) => ({
        x: candidate.x,
        y: candidate.y,
        connectorContact: candidate.contact,
      })),
      diagnostics: {
        candidateCount: domains.reduce((sum, domain) => sum + domain.length, 0),
        conflictCount: 0,
        exploredNodes: 0,
        candidateResolution: INITIAL_RESOLUTION,
        refinementConverged: false,
        finiteCandidateOptimal: false,
        metrics,
      },
    };
  }

  let selected = baseline;
  let exploredNodes = 0;
  let conflictCount = 0;
  let isComplete = true;
  let previousPrimaryScore: readonly number[] | null = null;
  let isRefinementConverged = false;
  let candidateResolution = INITIAL_RESOLUTION;
  for (const resolution of [INITIAL_RESOLUTION, ...REFINEMENT_RESOLUTIONS]) {
    if (resolution !== INITIAL_RESOLUTION) {
      refineDomains({ input, domains, selected, bounds, resolution });
    }

    const result = search(input, domains, selected, nodeLimit);
    exploredNodes += result.exploredNodes;
    conflictCount = result.conflictCount;
    isComplete &&= result.complete;
    selected = result.assignment;
    candidateResolution = resolution;
    const primaryScore = score(input, selected).slice(0, 4);
    isRefinementConverged =
      previousPrimaryScore !== null &&
      compareScores(primaryScore, previousPrimaryScore) === 0;
    previousPrimaryScore = primaryScore;
    if (!result.complete) {
      break;
    }
  }

  const metrics = layoutMetrics(input, selected);
  return {
    status: isComplete ? 'optimal' : 'feasible',
    plates: selected.map((candidate) => ({
      x: candidate.x,
      y: candidate.y,
      connectorContact: candidate.contact,
    })),
    diagnostics: {
      candidateCount: domains.reduce((sum, domain) => sum + domain.length, 0),
      conflictCount,
      exploredNodes,
      candidateResolution,
      refinementConverged: isRefinementConverged,
      finiteCandidateOptimal: isComplete,
      metrics,
    },
  };
}
