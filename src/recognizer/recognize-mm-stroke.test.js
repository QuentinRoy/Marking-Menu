import test from 'ava';
import { spy } from 'sinon';
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

const STROKES_PATH = path.resolve(__dirname, '__test-strokes__');

const readFile = promisify(fs.readFile);
const csvParse = promisify(csvParseCallback);

const createMockMMModel = (depth = 1, breadth = 8, requestedAngle, parent) => {
  if (depth === 0) {
    return { isLeaf: spy(() => true), requestedAngle, parent };
  } else if (depth > 0) {
    const m = {
      parent,
      requestedAngle,
      getMaxDepth: spy(() => depth),
      getMaxBreadth: spy(() => breadth),
      isLeaf: spy(() => false)
    };
    m.getNearestChildren = spy(childAngle =>
      createMockMMModel(depth - 1, breadth, childAngle, m)
    );
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

test('`pointsToSegments` returns a list of segments from a list of points', t => {
  t.deepEqual(pointsToSegments([[0, 3], [5, 3], [10, 8], [15, 4]]), [
    [[0, 3], [5, 3]],
    [[5, 3], [10, 8]],
    [[10, 8], [15, 4]]
  ]);
});

test('`divideLongestSegment` divide by two the longest segment of a list', t => {
  t.deepEqual(
    divideLongestSegment([
      { length: 10, angle: 5 },
      { length: 30, angle: 10 },
      { length: 20, angle: 20 }
    ]),
    [
      { length: 10, angle: 5 },
      { length: 15, angle: 10 },
      { length: 15, angle: 10 },
      { length: 20, angle: 20 }
    ]
  );
});

test('`walkMMModel` properly find an item from a segment list and a MM mode', t => {
  {
    const menu = createMockMMModel(1);
    const selection = walkMMModel(menu, [{ angle: 90 }]);
    t.is(selection.requestedAngle, 90);
    t.is(selection.parent, menu);
  }
  {
    const menu = createMockMMModel(2);
    const selection = walkMMModel(menu, [{ angle: 90 }, { angle: 180 }]);
    t.is(selection.requestedAngle, 180);
    t.is(selection.parent.requestedAngle, 90);
    t.is(selection.parent.parent, menu);
  }
  {
    const menu = createMockMMModel(3);
    const selection = walkMMModel(menu, [
      { angle: 90 },
      { angle: 0 },
      { angle: 180 }
    ]);
    t.is(selection.requestedAngle, 180);
    t.is(selection.parent.requestedAngle, 0);
    t.is(selection.parent.parent.requestedAngle, 90);
    t.is(selection.parent.parent.parent, menu);
  }
  {
    const menu = createMockMMModel(1);
    t.is(walkMMModel(menu, []), null);
  }
  {
    const menu = createMockMMModel(1);
    t.is(walkMMModel(menu, [{ angle: 200 }, { angle: 0 }]), null);
  }
  {
    const menu = createMockMMModel(2);
    t.is(
      walkMMModel(menu, [{ angle: 200 }, { angle: 5 }, { angle: 10 }]),
      null
    );
  }
});

test.todo('`findMMItem`');

test('`recognizeMMStroke` properly recognizes real 1 level strokes', async t => {
  const precision = 15;
  const testStroke = async strokeAngle => {
    // Read the stroke.
    const stroke = await readStroke(strokeAngle);
    // Create the model
    const model = createMockMMModel(1);
    // Apply the recognizer.
    const selection = recognizeMMStroke(stroke, model);
    // Make sure the angle is close to the expected stroke angle (mock model dynamically)
    t.true(angles.distance(selection.requestedAngle, strokeAngle) < precision);
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

test('`recognizeMMStroke` properly recognizes real 3 levels strokes', async t => {
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
    t.true(
      angles.distance(selection.requestedAngle, strokeAngles[2]) < precision
    );
    t.true(
      angles.distance(selection.parent.requestedAngle, strokeAngles[1]) <
        precision
    );
    t.true(
      angles.distance(selection.parent.parent.requestedAngle, strokeAngles[0]) <
        precision
    );
    t.is(selection.parent.parent.parent, model);
  };
  await testStroke([225, 0, 135]);
  await testStroke([270, 0, 90]);
  await testStroke([270, 45, 90]);
  await testStroke([270, 45, 270]);
  await testStroke([180, 0, 0]);
  await testStroke([90, 90, 90], 90);
  await testStroke([45, 45, 45], 45);
});

test('`recognizeMMStroke` returns null if the stroke does not correspond to an item', async t => {
  // Read the stroke.
  const stroke = await readStroke([225, 0, 135].join('-'));
  // Create the model
  const model = createMockMMModel(1);
  // Apply the recognizer.
  t.is(recognizeMMStroke(stroke, model), null);
});
