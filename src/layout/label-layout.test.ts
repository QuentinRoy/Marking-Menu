import {
  solveLabelLayout,
  type LabelLayoutInput,
  type LabelLayoutPlate,
} from './label-layout.js';

const CLEARANCES = {
  plateHorizontal: 14,
  plateVertical: 7,
  plateToRing: 12,
  plateToConnector: 3,
} as const;

const makeInput = (
  dimensions: ReadonlyArray<readonly [number, number]>,
  angles = dimensions.map((_, index) => (360 / dimensions.length) * index),
  searchNodeLimit = 250_000,
): LabelLayoutInput => ({
  plates: dimensions.map(([width, height], index) => ({
    angle: angles[index] ?? 0,
    width,
    height,
  })),
  ringRadius: 80,
  clearances: CLEARANCES,
  searchNodeLimit,
});

const pointToBoxDistance = (
  point: readonly [number, number],
  plate: LabelLayoutPlate,
  width: number,
  height: number,
): number => {
  const dx = Math.max(0, Math.abs(point[0] - plate.x) - width / 2);
  const dy = Math.max(0, Math.abs(point[1] - plate.y) - height / 2);
  return Math.hypot(dx, dy);
};

const doesSegmentHitBox = (
  start: readonly [number, number],
  end: readonly [number, number],
  box: {
    readonly plate: LabelLayoutPlate;
    readonly halfWidth: number;
    readonly halfHeight: number;
  },
): boolean => {
  const minimum = [
    box.plate.x - box.halfWidth,
    box.plate.y - box.halfHeight,
  ] as const;
  const maximum = [
    box.plate.x + box.halfWidth,
    box.plate.y + box.halfHeight,
  ] as const;
  const delta = [end[0] - start[0], end[1] - start[1]] as const;
  let entrance = 0;
  let exit = 1;
  for (const axis of [0, 1] as const) {
    if (Math.abs(delta[axis]) < 1e-8) {
      if (start[axis] < minimum[axis] || start[axis] > maximum[axis]) {
        return false;
      }

      continue;
    }

    const first = (minimum[axis] - start[axis]) / delta[axis];
    const second = (maximum[axis] - start[axis]) / delta[axis];
    entrance = Math.max(entrance, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
  }

  return entrance <= exit + 1e-7;
};

/**
 Checks results from their returned geometry rather than from the solver's
 candidate bookkeeping.
 */
const expectValidLayout = (
  input: LabelLayoutInput,
  plates: readonly LabelLayoutPlate[],
): void => {
  expect(plates).toHaveLength(input.plates.length);
  for (const [item, plate] of plates.entries()) {
    const source = input.plates[item];
    if (plate === undefined || source === undefined) {
      throw new Error('Missing plate in test fixture.');
    }

    expect(
      [plate.x, plate.y, ...plate.connectorContact].every((value) =>
        Number.isFinite(value),
      ),
    ).toBe(true);
    expect(
      pointToBoxDistance([0, 0], plate, source.width, source.height),
    ).toBeGreaterThanOrEqual(
      input.ringRadius + input.clearances.plateToRing - 1e-5,
    );

    const radians = (source.angle * Math.PI) / 180;
    const direction = [Math.cos(radians), Math.sin(radians)] as const;
    const cross =
      plate.connectorContact[0] * direction[1] -
      plate.connectorContact[1] * direction[0];
    expect(Math.abs(cross)).toBeLessThan(1e-5);
    expect(
      pointToBoxDistance(
        plate.connectorContact,
        plate,
        source.width,
        source.height,
      ),
    ).toBeLessThan(1e-5);
  }

  for (const [first, firstPlate] of plates.entries()) {
    const firstSource = input.plates[first];
    if (firstPlate === undefined || firstSource === undefined) {
      throw new Error('Missing first plate in test fixture.');
    }

    const radians = (firstSource.angle * Math.PI) / 180;
    const connectorStart = [
      input.ringRadius * Math.cos(radians),
      input.ringRadius * Math.sin(radians),
    ] as const;
    for (const [second, secondPlate] of plates.entries()) {
      const secondSource = input.plates[second];
      if (secondPlate === undefined || secondSource === undefined) {
        throw new Error('Missing second plate in test fixture.');
      }

      if (first !== second) {
        expect(
          doesSegmentHitBox(connectorStart, firstPlate.connectorContact, {
            plate: secondPlate,
            halfWidth:
              secondSource.width / 2 + input.clearances.plateToConnector,
            halfHeight:
              secondSource.height / 2 + input.clearances.plateToConnector,
          }),
        ).toBe(false);
      }

      if (second > first) {
        const isSeparatedHorizontally =
          Math.abs(firstPlate.x - secondPlate.x) >=
          (firstSource.width + secondSource.width) / 2 +
            input.clearances.plateHorizontal -
            1e-5;
        const isSeparatedVertically =
          Math.abs(firstPlate.y - secondPlate.y) >=
          (firstSource.height + secondSource.height) / 2 +
            input.clearances.plateVertical -
            1e-5;
        expect(isSeparatedHorizontally || isSeparatedVertically).toBe(true);
      }
    }
  }
};

const solveAndExpectValid = (input: LabelLayoutInput) => {
  const result = solveLabelLayout(input);
  expect(result.status).not.toBe('oversized');
  if (result.status === 'oversized') {
    throw new Error(result.reason);
  }

  expectValidLayout(input, result.plates);
  return result;
};

describe('solveLabelLayout', () => {
  it('lays out an empty menu', () => {
    const result = solveLabelLayout(makeInput([]));
    expect(result).toMatchObject({
      status: 'optimal',
      plates: [],
      diagnostics: { candidateCount: 0, exploredNodes: 0 },
    });
  });

  it('lays out realistic eight-item labels', () => {
    const input = makeInput([
      [54, 28],
      [112, 28],
      [86, 28],
      [98, 28],
      [46, 28],
      [134, 28],
      [42, 28],
      [104, 28],
    ]);
    const result = solveAndExpectValid(input);
    expect(result.diagnostics.metrics.maxContactRadius).toBeLessThan(300);
    expect(result.diagnostics.candidateCount).toBeGreaterThan(
      input.plates.length,
    );
  });

  it('handles twelve globally coupled plates with uneven widths', () => {
    const input = makeInput(
      Array.from(
        { length: 12 },
        (_, index) =>
          [index % 3 === 0 ? 176 : index % 2 === 0 ? 92 : 54, 28] as const,
      ),
      undefined,
      100_000,
    );
    const result = solveAndExpectValid(input);
    expect(result.diagnostics.metrics.maxContactRadius).toBeLessThan(500);
  });

  it('handles sixteen plates under a deterministic work limit', () => {
    const input = makeInput(
      Array.from(
        { length: 16 },
        (_, index) => [44 + ((index * 37) % 110), 28] as const,
      ),
      undefined,
      20_000,
    );
    const result = solveAndExpectValid(input);
    expect(['optimal', 'feasible']).toContain(result.status);
    expect(result.diagnostics.exploredNodes).toBeLessThanOrEqual(60_000);
  });

  it('handles clustered manual angles and the zero-degree boundary', () => {
    const input = makeInput(
      [
        [70, 28],
        [128, 28],
        [64, 28],
        [152, 28],
        [90, 28],
        [58, 28],
      ],
      [338, 354, 9, 33, 142, 238],
      100_000,
    );
    const result = solveAndExpectValid(input);
    expect(result.plates).toHaveLength(6);
  });

  it('returns exactly the same geometry for the same input', () => {
    const input = makeInput(
      Array.from(
        { length: 12 },
        (_, index) =>
          [52 + ((index * 29) % 100), 24 + (index % 2) * 8] as const,
      ),
      undefined,
      20_000,
    );
    expect(solveLabelLayout(input)).toEqual(solveLabelLayout(input));
  });

  it('validates a seeded corpus', () => {
    let state = 615;
    const random = () => {
      state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
      return state / 4_294_967_296;
    };

    let solved = 0;
    for (const count of [4, 8, 12, 16]) {
      for (let fixture = 0; fixture < 3; fixture += 1) {
        const dimensions = Array.from(
          { length: count },
          () =>
            [
              36 + Math.floor(random() * 150),
              22 + Math.floor(random() * 18),
            ] as const,
        );
        solveAndExpectValid(makeInput(dimensions, undefined, 10_000));
        solved += 1;
      }
    }

    expect(solved).toBe(12);
  });

  it('reports a layout that exceeds its supported extent', () => {
    const result = solveLabelLayout(makeInput([[10_000, 28]]));
    expect(result).toEqual({
      status: 'oversized',
      plates: [],
      reason: 'No valid layout was found within 4096px of the menu center.',
    });
  });

  it('rejects invalid dimensions and duplicate angles', () => {
    expect(() => solveLabelLayout(makeInput([[-1, 20]]))).toThrow(RangeError);
    expect(() =>
      solveLabelLayout(
        makeInput(
          [
            [40, 20],
            [40, 20],
          ],
          [0, 360],
        ),
      ),
    ).toThrow(RangeError);
  });
});
