import test from 'ava';
import { deltaAngle, mod, dist } from '../utils';

test('`mod` returns a positive modulo', t => {
  t.is(mod(3, 10), 3);
  t.is(mod(-3, 10), 7);
  t.is(mod(13, 10), 3);
  t.is(mod(-13, 10), 7);
});

test('`deltaAngle` properly returns the delta between two angles', t => {
  t.is(deltaAngle(40, 50), 10);

  t.is(deltaAngle(40, 50 + 360), 10);
  t.is(deltaAngle(40, 50 - 360), 10);
  t.is(deltaAngle(40 + 360, 50), 10);
  t.is(deltaAngle(40 - 360, 50), 10);

  t.is(deltaAngle(50, 40), -10);

  t.is(deltaAngle(50, 40 + 360), -10);
  t.is(deltaAngle(50, 40 - 360), -10);
  t.is(deltaAngle(50 + 360, 40), -10);
  t.is(deltaAngle(50 - 360, 40), -10);
});

test('`dist` returns the euclidean distance between two vectors', t => {
  t.is(dist([0, 0], [0, 0]), 0);
  t.is(dist([42, 11], [42, 11]), 0);

  t.is(dist([0, 0], [0, 1]), 1);
  t.is(dist([1, 0], [0, 0]), 1);

  t.is(dist([5, 10], [20, 4]), Math.sqrt((5 - 20) ** 2 + (10 - 4) ** 2));
  t.is(dist([20, 4], [5, 10]), Math.sqrt((5 - 20) ** 2 + (10 - 4) ** 2));

  t.is(dist([42, 11, 5, 8, 0], [42, 11, 5, 8, 0]), 0);
  t.is(dist([1, 1, 0, 0, 1], [0, 0, 1, 1, 0]), Math.sqrt(5));
  t.is(
    dist([1, 2, 3, 7, 8], [4, 5, 6, 9, 10]),
    Math.sqrt(
      (1 - 4) ** 2 + (2 - 5) ** 2 + (3 - 6) ** 2 + (7 - 9) ** 2 + (8 - 10) ** 2
    )
  );
});
