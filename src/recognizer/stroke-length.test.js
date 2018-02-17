import test from 'ava';
import strokeLength from './stroke-length';

test('`strokeLength` properly calculate the length of a path', t => {
  t.is(strokeLength([]), 0);
  t.is(strokeLength([[54, 234]]), 0);
  t.is(strokeLength([[1, 0], [1, 1.5], [1, 2], [3.2, 2]]), 4.2);
  t.is(strokeLength([[1, 0], [1, 1], [1, 0]]), 2);
  t.is(strokeLength([[0, 0], [1, 1], [1, 2]]), 1 + Math.sqrt(2));
  t.is(strokeLength([[0, 0, 0], [0, 0, 1], [1, 0, 1]]), 2);
});
