import test from 'ava';
import { deltaAngle, mod } from '../utils';

test('mod returns a positive modulo', t => {
  t.is(mod(3, 10), 3);
  t.is(mod(-3, 10), 7);
  t.is(mod(13, 10), 3);
  t.is(mod(-13, 10), 7);
});

test('deltaAngle properly returns the delta between two angles', t => {
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
