import test from 'ava';
import {
  findMiddlePointForMinAngle,
  findNextPointFurtherThan
} from './find-points';

test('`findMiddlePointForMaxAngle` the point maximizing the angle', t => {
  t.deepEqual(
    findMiddlePointForMinAngle(
      [0, 0],
      [5, 5],
      [[5, 2], [5, 0], [0, 3], [3, 0]]
    ),
    { index: 1, angle: 90 },
    'Simple 90 degrees angle.'
  );
  t.deepEqual(
    findMiddlePointForMinAngle(
      [-5, 0],
      [1, 0],
      [[0, 0], [-1, 0], [-4, 1], [-3, 0], [4, 0], [0, 0]]
    ),
    { index: 4, angle: 0 },
    '360 degrees angle.'
  );
  t.deepEqual(
    findMiddlePointForMinAngle(
      [0, 0],
      [5, 5],
      [[5, 2], [0, 3], [0, 5], [3, 0], [0, 10]]
    ),
    { index: 4, angle: 45 },
    'Simple 45 degrees angle'
  );
  t.deepEqual(
    findMiddlePointForMinAngle(
      [-5, 0],
      [1, 0],
      [[6, 0], [-1, 0], [-4, 1], [-3, 0], [4, 0], [5, 0]],
      { startIndex: 1 }
    ),
    { index: 4, angle: 0 },
    '`startIndex` is properly took into account.'
  );
  t.deepEqual(
    findMiddlePointForMinAngle(
      [0, 0],
      [5, 5],
      [[5, 2], [0, 3], [0, 5], [3, 0], [0, 10]],
      { endIndex: 3 }
    ),
    { index: 2, angle: 90 },
    '`endIndex` is properly took into account.'
  );
  t.deepEqual(
    findMiddlePointForMinAngle(
      [0, 0],
      [5, 5],
      [[0, 5], [5, 2], [0, 3], [0, 5], [3, 0], [0, 10]],
      { startIndex: 1, endIndex: 3 }
    ),
    { index: 3, angle: 90 },
    '`startIndex` and `endIndex` are properly took into account together.'
  );
});

test('`findNextPointFurtherThan` properly find the first point at last a given distance from the refpoints', t => {
  t.is(
    findNextPointFurtherThan(
      [[0, 1], [1, 1], [1, 2], [2, 2], [1, 2], [0, 3], [0, 4], [0, 5], [0, 6]],
      5,
      { startIndex: 0, refPoint: [0, 0], direction: 1 }
    ),
    7,
    '`findNextPointFurtherThan` works with simple cases.'
  );
  t.is(
    findNextPointFurtherThan(
      [[7, 7], [1, 1], [1, 2], [2, 2], [1, 2], [0, 3], [0, 4], [0, 5], [0, 6]],
      5,
      { startIndex: 0, refPoint: [0, 0], direction: 1 }
    ),
    0,
    '`findNextPointFurtherThan` works if the point to find is the first.'
  );
  t.is(
    findNextPointFurtherThan(
      [[1, 1], [1, 2], [2, 2], [0, 4], [1, 6], [2, 7]],
      10,
      { startIndex: 0, refPoint: [0, 0], direction: 1 }
    ),
    -1,
    '`findNextPointFurtherThan` returns -1 if the point is unfound.'
  );
  t.is(
    findNextPointFurtherThan([], 0, 0, { refPoint: [0, 0], direction: 1 }),
    -1,
    '`findNextPointFurtherThan` returns -1 if the list is empty.'
  );
  t.is(
    findNextPointFurtherThan(
      [[7, 7], [1, 1], [1, 2], [2, 2], [1, 2], [0, 3], [0, 4], [0, 5], [0, 6]],
      5,
      { startIndex: 1, refPoint: [0, 0], direction: 1 }
    ),
    7,
    '`findNextPointFurtherThan` respects the `startIndex` argument.'
  );
  t.is(
    findNextPointFurtherThan(
      [[7, 7], [1, 1], [1, 2], [2, 2], [0, 4], [1, 6], [2, 6]],
      5,
      { startIndex: 1, direction: 1 }
    ),
    5,
    '`findNextPointFurtherThan` properly works with default `refPoint`.'
  );

  t.is(
    findNextPointFurtherThan(
      [[7, 7], [1, 1], [1, 2], [2, 2], [0, 4], [1, 6], [2, 6]],
      5,
      { startIndex: 1, refPoint: [0, 0] }
    ),
    5,
    '`findNextPointFurtherThan` properly works with default `direction`.'
  );
  t.is(
    findNextPointFurtherThan(
      [[1, 1], [1, 2], [2, 2], [0, 4], [1, 6], [2, 7]],
      5,
      { direction: 1, refPoint: [2, 2] }
    ),
    5,
    '`findNextPointFurtherThan` properly works with default `startIndex`.'
  );
  t.is(
    findNextPointFurtherThan(
      [[1, 1], [1, 2], [2, 2], [0, 4], [1, 6], [2, 7]],
      5
    ),
    4,
    '`findNextPointFurtherThan` properly works with no `options`.'
  );
  t.is(
    findNextPointFurtherThan([], 0),
    -1,
    '`findNextPointFurtherThan` returns -1 if the list is empty even with no `options`.'
  );
  t.is(
    findNextPointFurtherThan(
      [[1, 6], [2, 7], [1, 1], [1, 2], [2, 2], [0, 4]],
      5,
      { startIndex: 4, refPoint: [0, 0], direction: -1 }
    ),
    1,
    '`findNextPointFurtherThan` properly respect negative direction.'
  );
  t.is(
    findNextPointFurtherThan(
      [[-4, -4], [1, 1], [2, 2], [5, 5], [2, 2], [1, 1], [0, 0]],
      2,
      { direction: -1 }
    ),
    4,
    '`findNextPointFurtherThan` properly set up default options with negative direction.'
  );
});
