import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import angles from 'angles';
import { parse as csvParseCallback } from 'csv-parse';
import { type Mock } from 'vitest';
import type { ModelItem } from '../types.js';
import type { Point } from '../utils.js';
import {
  analyzeMarkingMenuStroke,
  divideLongestSegment,
  findItem,
  pointsToSegments,
  recognizeMarkingMenuStroke,
  walkModel,
} from './recognize-mm-stroke.js';
import { strokeLength } from './stroke-length.js';

const STROKES_PATH = path.resolve(
  import.meta.dirname,
  '__fixtures__',
  'strokes',
);

const readFile = promisify(fs.readFile);
// Promisified csv-parse (its overloaded signature does not survive `promisify`).
const csvParse = async (
  data: Uint8Array,
): Promise<Array<Record<string, string>>> =>
  new Promise((resolve, reject) => {
    csvParseCallback<Record<string, string>>(
      data,
      { columns: true },
      (error, records) => {
        if (error) {
          reject(error);
        } else {
          resolve(records);
        }
      },
    );
  });

type MockModel = ModelItem<string | undefined, string, readonly MockModel[]> & {
  requestedAngle: number | undefined;
  parent: MockModel | null;
  getMaxDepth: Mock<() => number>;
  getMaxBreadth: Mock<() => number>;
  getNearestChild: Mock<(childAngle?: number) => MockModel>;
};

/*
 `MockModel` describes its children with an unbounded `readonly MockModel[]`
 rather than a tuple, so `ModelLeaves<MockModel>` collapses to `never`: the
 mock's children only exist at runtime, through `getNearestChild`. The tests
 below that read properties off the result therefore go through the general
 overload, which returns the wider `ModelNodes<MockModel>`.
 */
const anyRecognizedItem: { requireLeaf?: boolean; requireMenu?: boolean } = {
  requireLeaf: true,
};

const createMockModel = (
  depth = 1,
  breadth = 8,
  requestedAngle?: number,
  parent: MockModel | null = null,
): MockModel => {
  const base = {
    items: [],
    id: undefined,
    key: 'mock',
    label: 'Mock',
    angle: requestedAngle ?? 0,
    getChild: vi.fn(() => null),
    getChildrenByLabel: vi.fn(() => []),
    isRoot: false as const,
    parent,
  };
  if (depth === 0) {
    return {
      ...base,
      isLeaf: true,
      isRoot: false,
      getMaxDepth: vi.fn(() => 0),
      getMaxBreadth: vi.fn(() => 0),
      getNearestChild: vi.fn<(childAngle?: number) => MockModel>(),
      requestedAngle,
    };
  }

  if (depth > 0) {
    const m: MockModel = {
      ...base,
      requestedAngle,
      getMaxDepth: vi.fn(() => depth),
      getMaxBreadth: vi.fn(() => breadth),
      isLeaf: false,
      getNearestChild: vi.fn((childAngle?: number) =>
        createMockModel(depth - 1, breadth, childAngle, m),
      ),
    };
    return m;
  }

  throw new Error(`Invalid depth: ${depth}`);
};

const readStroke = async (strokeName: string | number): Promise<Point[]> => {
  const data = await readFile(path.resolve(STROKES_PATH, `${strokeName}.csv`));
  const lines = await csvParse(data);
  return lines.map((row): Point => [Number(row.x), 4000 - Number(row.y)]);
};

describe('pointsToSegments', () => {
  it('returns a list of segments from a list of points', () => {
    expect(
      pointsToSegments([
        [0, 3],
        [5, 3],
        [10, 8],
        [15, 4],
      ]),
    ).toEqual([
      [
        [0, 3],
        [5, 3],
      ],
      [
        [5, 3],
        [10, 8],
      ],
      [
        [10, 8],
        [15, 4],
      ],
    ]);
  });
});

describe('divideLongestSegment', () => {
  it('divides by two the longest segment of a list', () => {
    expect(
      divideLongestSegment([
        { length: 10, angle: 5 },
        { length: 30, angle: 10 },
        { length: 20, angle: 20 },
      ]),
    ).toEqual([
      { length: 10, angle: 5 },
      { length: 15, angle: 10 },
      { length: 15, angle: 10 },
      { length: 20, angle: 20 },
    ]);
  });
});

describe('walkModel', () => {
  it('returns the path walked from a segment list and a MM model', () => {
    {
      const menu = createMockModel(1);
      const walkedPath = walkModel({ model: menu, segments: [{ angle: 90 }] });
      expect(walkedPath?.map((item) => item.requestedAngle)).toEqual([90]);
    }

    {
      const menu = createMockModel(2);
      const walkedPath = walkModel({
        model: menu,
        segments: [{ angle: 90 }, { angle: 180 }],
      });
      expect(walkedPath?.map((item) => item.requestedAngle)).toEqual([90, 180]);
    }

    {
      const menu = createMockModel(3);
      const walkedPath = walkModel({
        model: menu,
        segments: [{ angle: 90 }, { angle: 0 }, { angle: 180 }],
      });
      expect(walkedPath?.map((item) => item.requestedAngle)).toEqual([
        90, 0, 180,
      ]);
    }

    {
      const menu = createMockModel(1);
      expect(walkModel({ model: menu, segments: [] })).toBe(null);
    }

    {
      const menu = createMockModel(1);
      expect(
        walkModel({ model: menu, segments: [{ angle: 200 }, { angle: 0 }] }),
      ).toBe(null);
    }

    {
      const menu = createMockModel(2);
      expect(
        walkModel({
          model: menu,
          segments: [{ angle: 200 }, { angle: 5 }, { angle: 10 }],
        }),
      ).toBe(null);
    }
  });

  it('starts walking at the configured segment index', () => {
    const menu = createMockModel(1);
    const walkedPath = walkModel({
      model: menu,
      segments: [{ angle: 0 }, { angle: 90 }],
      startIndex: 1,
    });

    expect(walkedPath?.map((item) => item.requestedAngle)).toEqual([90]);
  });
});

describe('findItem', () => {
  it('finds an item using the model depth by default', () => {
    const menu = createMockModel(2);
    const foundPath = findItem({
      model: menu,
      segments: [
        { angle: 90, length: 10 },
        { angle: 180, length: 10 },
      ],
    });

    expect(foundPath?.map((item) => item.requestedAngle)).toEqual([90, 180]);
    expect(menu.getMaxDepth).toHaveBeenCalledOnce();
  });

  it('uses the configured maximum depth', () => {
    const menu = createMockModel(2);
    const foundPath = findItem({
      model: menu,
      segments: [{ angle: 90, length: 10 }],
      maxDepth: 1,
    });

    expect(foundPath?.map((item) => item.requestedAngle)).toEqual([90]);
  });
});

describe('recognizeMarkingMenuStroke', () => {
  it('recognizes real 1 level strokes', async () => {
    const precision = 15;
    const testStroke = async (strokeAngle: number) => {
      // Read the stroke.
      const stroke = await readStroke(strokeAngle);
      // Create the model
      const model = createMockModel(1);
      // Apply the recognizer.
      const selection = recognizeMarkingMenuStroke(
        stroke,
        model,
        anyRecognizedItem,
      );
      // Make sure the angle is close to the expected stroke angle (mock model dynamically)
      expect(
        angles.distance(selection?.requestedAngle ?? NaN, strokeAngle) <
          precision,
      ).toBe(true);
    };

    await testStroke(0);
    await testStroke(45);
    await testStroke(90);
    await testStroke(135);
    await testStroke(180);
    await testStroke(225);
    await testStroke(270);
    await testStroke(315);
  });

  it('recognizes real 3 levels strokes', async () => {
    const precision = 15;
    const testStroke = async (
      strokeAngles: [number, number, number],
      strokeName: string | number = strokeAngles.join('-'),
    ) => {
      // Read the stroke.
      const stroke = await readStroke(strokeName);
      // Create the model
      const model = createMockModel(3);
      // Apply the recognizer.
      const selection = recognizeMarkingMenuStroke(
        stroke,
        model,
        anyRecognizedItem,
      );
      // Make sure the angle is close to the expected stroke angle (mock model dynamically).
      expect(
        angles.distance(selection?.requestedAngle ?? NaN, strokeAngles[2]) <
          precision,
      ).toBe(true);
      expect(
        angles.distance(
          selection?.parent?.requestedAngle ?? NaN,
          strokeAngles[1],
        ) < precision,
      ).toBe(true);
      expect(
        angles.distance(
          selection?.parent?.parent?.requestedAngle ?? NaN,
          strokeAngles[0],
        ) < precision,
      ).toBe(true);
      expect(selection?.parent?.parent?.parent).toBe(model);
    };

    await testStroke([225, 0, 135]);
    await testStroke([270, 0, 90]);
    await testStroke([270, 45, 90]);
    await testStroke([270, 45, 270]);
    await testStroke([180, 0, 0]);
    await testStroke([90, 90, 90], 90);
    await testStroke([45, 45, 45], 45);
  });

  it('returns null if the stroke does not correspond to an item', async () => {
    // Read the stroke.
    const stroke = await readStroke([225, 0, 135].join('-'));
    // Create the model
    const model = createMockModel(1);
    // Apply the recognizer.
    expect(recognizeMarkingMenuStroke(stroke, model)).toBe(null);
  });

  it('returns null if the stroke does not correspond to a leaf and requireLeaf is true (default)', async () => {
    // Read the stroke.
    const stroke = await readStroke([225, 0, 135].join('-'));
    // Create the model
    const model = createMockModel(5);
    // Apply the recognizer.
    expect(recognizeMarkingMenuStroke(stroke, model, { maxDepth: 3 })).toBe(
      null,
    );
  });

  it('always returns a menu if requireMenu is true', async () => {
    // Read the stroke.
    const stroke = await readStroke([225, 0, 135].join('-'));
    // Create the model
    const model = createMockModel(3);
    // Apply the recognizer.
    expect(
      recognizeMarkingMenuStroke(stroke, model, {
        maxDepth: 3,
        requireMenu: true,
      })?.isLeaf,
    ).toBe(false);
  });

  it('treats a negative maxDepth as relative to the model maximum depth', async () => {
    // Read the stroke.
    const stroke = await readStroke('90');
    // Create the model
    const model = createMockModel(3);
    // Apply the recognizer with a max depth of 3 - 1 = 2.
    const selection = recognizeMarkingMenuStroke(stroke, model, {
      maxDepth: -1,
      requireMenu: true,
    });
    // The selection is the depth 2 menu: it is returned as is by requireMenu.
    expect(selection?.isLeaf).toBe(false);
    expect(angles.distance(selection?.requestedAngle ?? NaN, 90) < 15).toBe(
      true,
    );
    expect(
      angles.distance(selection?.parent?.requestedAngle ?? NaN, 90) < 15,
    ).toBe(true);
    expect(selection?.parent?.parent).toBe(model);
  });

  it('throws if both requireMenu and requireLeaf are true', () => {
    expect(() => {
      recognizeMarkingMenuStroke([], createMockModel(), {
        requireMenu: true,
        requireLeaf: true,
      });
    }).toThrow('The result cannot be both a leaf and a menu');
  });
});

describe('analyzeMarkingMenuStroke', () => {
  it('finds the same path recognizeMarkingMenuStroke would', async () => {
    const stroke = await readStroke([225, 0, 135].join('-'));
    const model = createMockModel(3);

    // Mock items are recreated on every `getNearestChild` call (see
    // `createMockModel`), so the two calls below never share item instances.
    // `requestedAngle` is what each level was actually reached with, and is
    // what the other "recognizes real 3 levels strokes" tests already key
    // off of to compare paths for that same reason.
    const analysis = analyzeMarkingMenuStroke(stroke, model);
    const recognized = recognizeMarkingMenuStroke(stroke, model, {
      requireMenu: false,
      requireLeaf: false,
    });

    expect(analysis.path?.at(-1)?.requestedAngle).toBe(
      recognized?.requestedAngle,
    );
    expect(analysis.path?.at(-1)?.parent?.requestedAngle).toBe(
      recognized?.parent?.requestedAngle,
    );
    expect(analysis.path?.at(-1)?.parent?.parent?.requestedAngle).toBe(
      recognized?.parent?.parent?.requestedAngle,
    );
  });

  it('derives the angle threshold from the model breadth', async () => {
    const stroke = await readStroke(90);
    const model = createMockModel(1, 8);

    const { angleThreshold } = analyzeMarkingMenuStroke(stroke, model);

    expect(angleThreshold).toBeCloseTo(360 / 8 / 2 / 0.75);
  });

  it('derives the expected segment length from the stroke length and depth', async () => {
    const stroke = await readStroke(90);
    const model = createMockModel(1);

    const { expectedSegmentLength } = analyzeMarkingMenuStroke(stroke, model);

    expect(expectedSegmentLength).toBeCloseTo(strokeLength(stroke) / 1);
  });

  it('reports articulation points bounding the whole stroke', async () => {
    const stroke = await readStroke([225, 0, 135].join('-'));
    const model = createMockModel(3);

    const { articulationPoints } = analyzeMarkingMenuStroke(stroke, model);

    expect(articulationPoints[0]).toEqual(stroke[0]);
    expect(articulationPoints.at(-1)).toEqual(stroke.at(-1));
  });

  it('reports segments as a subsequence of the corners joined pairwise', async () => {
    const stroke = await readStroke([225, 0, 135].join('-'));
    const model = createMockModel(3);

    const { articulationPoints, segments } = analyzeMarkingMenuStroke(
      stroke,
      model,
    );
    const everyPossibleSegment = pointsToSegments([...articulationPoints]);

    expect(segments.length).toBeGreaterThan(0);
    for (const segment of segments) {
      expect(everyPossibleSegment).toContainEqual(segment.points);
    }
  });
});
