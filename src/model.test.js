import test from 'ava';
import createModel, { MMItem } from './model';

test('`MMItem` can be created properly', t => {
  const a = new MMItem('id', 'name', 10);
  t.is(a.angle, 10);
  t.is(a.id, 'id');
  t.is(a.name, 'name');
});

test('`MMItem#isLeaf` checks if the item has children', t => {
  t.is(new MMItem('a', 'name', 10).isLeaf(), true);
  t.is(new MMItem('b', 'name', 10, []).isLeaf(), true);
  t.is(
    new MMItem('c', 'name', 10, [new MMItem('sub', 'child', 5)]).isLeaf(),
    false
  );
});

test('`MMItem#getChild` returns the (first) child with the corresponding id', t => {
  const children = [
    new MMItem('sub1', 'child1', 180),
    new MMItem('sub2', 'child2', 90),
    new MMItem('sub2', 'child2', 100) // This should not be allowed
  ];
  const mi = new MMItem('a', 'name', 10, children);
  t.is(mi.getChild('sub1'), children[0]);
  t.is(mi.getChild('sub2'), children[1]);
});

test('`MMItem#getChildrenByName` returns the children with the corresponding name', t => {
  const children = [
    new MMItem('sub1', 'child1', 180),
    new MMItem('sub2', 'child2', 90),
    new MMItem('sub2', 'child2', 120) // Odd, but why not.
  ];
  const mi = new MMItem('a', 'name', 10, children);
  t.deepEqual(mi.getChildrenByName('child2'), children.slice(1));
});

test('`MMItem#getNearestChild` returns the childen the closest to the provided angle', t => {
  const children = [
    new MMItem('sub1', 'child1', 180),
    new MMItem('sub2', 'child2', 90),
    new MMItem('sub3', 'child3', 45),
    new MMItem('sub4', 'child3', 0)
  ];
  const mi = new MMItem('a', 'name', 10, children);
  t.is(mi.getNearestChild(45), children[2]);
  t.is(mi.getNearestChild(220), children[0]);
  t.is(mi.getNearestChild(300), children[3]);
});

test('`MMItem#getMaxDepth` return the maximum depth of the item hierarchy', t => {
  t.is(new MMItem('id', 'name', 0).getMaxDepth(), 0);

  const m = new MMItem('id', 'n', 0, [
    new MMItem('sub1', 'child1', 180, [
      new MMItem('subsub1', 'subchild1', 180),
      new MMItem('subsub2', 'subchild2', 90),
      new MMItem('subsub3', 'subchild3', 45),
      new MMItem('subsub4', 'subchild4', 0, [
        new MMItem('subsubsub1', 'subsubchild1', 0),
        new MMItem('subsubsub2', 'subsubchild2', 0)
      ])
    ]),
    new MMItem('sub2', 'child2', 90),
    new MMItem('sub3', 'child3', 45, [new MMItem('subsub5', 'subchild5', 0)]),
    new MMItem('sub4', 'child3', 0)
  ]);
  t.is(m.getMaxDepth(), 3);
});

test('`MMItem#getMaxBreadth` return the maximum breadth of the item hierarchy', t => {
  t.is(new MMItem('id', 'name', 0).getMaxBreadth(), 0);

  const m = new MMItem('id', 'n', 0, [
    new MMItem('sub1', 'child1', 180, [
      new MMItem('subsub1', 'subchild1', 180),
      new MMItem('subsub2', 'subchild2', 90),
      new MMItem('subsub3', 'subchild3', 45),
      new MMItem('subsub4', 'subchild4', 0, [
        new MMItem('subsubsub1', 'subsubchild1', 0),
        new MMItem('subsubsub2', 'subsubchild2', 0)
      ])
    ]),
    new MMItem('sub2', 'child2', 90),
    new MMItem('sub3', 'child3', 45, [new MMItem('subsub5', 'subchild5', 0)])
  ]);
  t.is(m.getMaxBreadth(), 4);
});

test('`createModel` creates a whole hierarchy of menu items', t => {
  const m = createModel([
    'right',
    {
      name: 'bottom',
      children: [
        'Sub 1',
        { name: 'Sub 2', id: 'custom-id' },
        'Sub 3',
        'Sub 4',
        'Sub 5',
        'Sub 6'
      ]
    },
    'left',
    'up'
  ]);

  // Check that the names are correct.
  t.deepEqual(m.children.map(c => c.name), ['right', 'bottom', 'left', 'up']);
  t.deepEqual(
    m.children[1].children.map(c => c.name), //
    ['Sub 1', 'Sub 2', 'Sub 3', 'Sub 4', 'Sub 5', 'Sub 6']
  );

  // Check that ids are all unique
  t.true(
    m.children.every(c1 => m.children.every(c2 => c2 === c1 || c2.id !== c1.id))
  );
  t.true(
    m.children[1].children.every(c1 =>
      m.children[1].children.every(c2 => c2 === c1 || c2.id !== c1.id)
    )
  );

  // Check that the angles are properly set up.
  t.deepEqual(m.children.map(c => c.angle), [0, 90, 180, 270]);
  t.deepEqual(
    m.children[1].children.map(c => c.angle), //
    [0, 45, 90, 135, 180, 225]
  );

  // Check that the custom-id has been properly set.
  t.is(m.children[1].children[1].id, 'custom-id');
});
