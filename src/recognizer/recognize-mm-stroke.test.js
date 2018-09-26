import fs from 'fs';
import path from 'path';
import csvParseCallback from 'csv-parse';
import angles from 'angles';
import { promisify } from 'util';
import recognizeMMStroke, {
  pointsToSegments,
  divideLongestSegment,
  walkMMModel
} from './recognize-mm-stroke';

const STROKES_PATH = path.resolve(__dirname, '__fixtures__', 'strokes');

const readFile = promisify(fs.readFile);
const csvParse = promisify(csvParseCallback);

const createMockMMModel = (depth = 1, breadth = 8, requestedAngle, parent) => {
  if (depth === 0) {
    return { isLeaf: jest.fn(() => true), requestedAngle, parent };
  }
  if (depth > 0) {
    const m = {
      parent,
      requestedAngle,
      getMaxDepth: jest.fn(() => depth),
      getMaxBreadth: jest.fn(() => breadth),
      isLeaf: jest.fn(() => false),
      getNearestChild: jest.fn(childAngle =>
        createMockMMModel(depth - 1, breadth, childAngle, m)
      )
    };
    return m;
  }
  throw new Error(`Invalid depth: ${depth}`);
};

const readStroke = async strokeName => {
  const data = await readFile(path.resolve(STROKES_PATH, `${strokeName}.csv`));
  const lines = await csvParse(data, { columns: true });
  // Adapt the line, inverting y so that the origin is on the top instead of the bottom.
  return lines.map(row => [+row.x, 4000 - row.y]);
};

describe('pointsToSegments', () => {
  it('returns a list of segments from a list of points', () => {
    expect(pointsToSegments([[0, 3], [5, 3], [10, 8], [15, 4]])).toEqual([
      [[0, 3], [5, 3]],
      [[5, 3], [10, 8]],
      [[10, 8], [15, 4]]
    ]);
  });
});

describe('divideLongestSegment', () => {
  it('divides by two the longest segment of a list', () => {
    expect(
      divideLongestSegment([
        { length: 10, angle: 5 },
        { length: 30, angle: 10 },
        { length: 20, angle: 20 }
      ])
    ).toEqual([
      { length: 10, angle: 5 },
      { length: 15, angle: 10 },
      { length: 15, angle: 10 },
      { length: 20, angle: 20 }
    ]);
  });
});

describe('walkMMModel', () => {
  it('finds an item from a segment list and a MM mode', () => {
    {
      const menu = createMockMMModel(1);
      const selection = walkMMModel(menu, [{ angle: 90 }]);
      expect(selection.requestedAngle).toBe(90);
      expect(selection.parent).toBe(menu);
    }
    {
      const menu = createMockMMModel(2);
      const selection = walkMMModel(menu, [{ angle: 90 }, { angle: 180 }]);
      expect(selection.requestedAngle).toBe(180);
      expect(selection.parent.requestedAngle).toBe(90);
      expect(selection.parent.parent).toBe(menu);
    }
    {
      const menu = createMockMMModel(3);
      const selection = walkMMModel(menu, [
        { angle: 90 },
        { angle: 0 },
        { angle: 180 }
      ]);
      expect(selection.requestedAngle).toBe(180);
      expect(selection.parent.requestedAngle).toBe(0);
      expect(selection.parent.parent.requestedAngle).toBe(90);
      expect(selection.parent.parent.parent).toBe(menu);
    }
    {
      const menu = createMockMMModel(1);
      expect(walkMMModel(menu, [])).toBe(null);
    }
    {
      const menu = createMockMMModel(1);
      expect(walkMMModel(menu, [{ angle: 200 }, { angle: 0 }])).toBe(null);
    }
    {
      const menu = createMockMMModel(2);
      expect(
        walkMMModel(menu, [{ angle: 200 }, { angle: 5 }, { angle: 10 }])
      ).toBe(null);
    }
  });
});

describe('recognizeMMStroke', () => {
  it('recognizes real 1 level strokes', async () => {
    const precision = 15;
    const testStroke = async strokeAngle => {
      // Read the stroke.
      const stroke = await readStroke(strokeAngle);
      // Create the model
      const model = createMockMMModel(1);
      // Apply the recognizer.
      const selection = recognizeMMStroke(stroke, model);
      // Make sure the angle is close to the expected stroke angle (mock model dynamically)
      expect(
        angles.distance(selection.requestedAngle, strokeAngle) < precision
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
      strokeAngles,
      strokeName = strokeAngles.join('-')
    ) => {
      // Read the stroke.
      const stroke = await readStroke(strokeName);
      // Create the model
      const model = createMockMMModel(3);
      // Apply the recognizer.
      const selection = recognizeMMStroke(stroke, model);
      // Make sure the angle is close to the expected stroke angle (mock model dynamically).
      expect(
        angles.distance(selection.requestedAngle, strokeAngles[2]) < precision
      ).toBe(true);
      expect(
        angles.distance(selection.parent.requestedAngle, strokeAngles[1]) <
          precision
      ).toBe(true);
      expect(
        angles.distance(
          selection.parent.parent.requestedAngle,
          strokeAngles[0]
        ) < precision
      ).toBe(true);
      expect(selection.parent.parent.parent).toBe(model);
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
    const model = createMockMMModel(1);
    // Apply the recognizer.
    expect(recognizeMMStroke(stroke, model)).toBe(null);
  });

  it('returns null if the stroke does not correspond to a leaf and requireLeaf is true (default)', async () => {
    // Read the stroke.
    const stroke = await readStroke([225, 0, 135].join('-'));
    // Create the model
    const model = createMockMMModel(5);
    // Apply the recognizer.
    expect(recognizeMMStroke(stroke, model, { maxDepth: 3 })).toBe(null);
  });

  it('always returns a menu if requireMenu is true', async () => {
    // Read the stroke.
    const stroke = await readStroke([225, 0, 135].join('-'));
    // Create the model
    const model = createMockMMModel(3);
    // Apply the recognizer.
    expect(
      recognizeMMStroke(stroke, model, {
        maxDepth: 3,
        requireMenu: true
      }).isLeaf()
    ).toBe(false);
  });

  it('throws if both requireMenu and requireLeaf are true', async () => {
    expect(() => {
      recognizeMMStroke('stroke', createMockMMModel(), {
        requireMenu: true,
        requireLeaf: true
      });
    }).toThrow('The result cannot be both a leaf and a menu');
  });
});
