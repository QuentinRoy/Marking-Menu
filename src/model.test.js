import test from 'ava';
import createModel from './model';

test.todo('Create all model related tests');

test('`Item#getMaxDepth` return the maximum depth of the model', t => {
  t.is(createModel(['a', 'b', 'c']).getMaxDepth(), 1);
  t.is(
    createModel([
      'a',
      { name: 'b', children: ['d', 'e', 'f'] },
      'c'
    ]).getMaxDepth(),
    2
  );
});

test('`Item#getMaxBreadth` return the maximum breadth of the model', t => {
  t.is(createModel(['a', 'b', 'c']).getMaxBreadth(), 3);
  t.is(
    createModel([
      'a',
      { name: 'b', children: ['d', 'e', 'f', 'g'] },
      'c'
    ]).getMaxBreadth(),
    4
  );
});
