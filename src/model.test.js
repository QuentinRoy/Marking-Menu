import createModel, { MMItem } from './model';

describe('MMItem', () => {
  it('can be created properly', () => {
    const a = new MMItem('id', 'name', 10);
    expect(a.angle).toBe(10);
    expect(a.id).toBe('id');
    expect(a.name).toBe('name');
  });

  it('isLeaf checks if the item has children', () => {
    expect(new MMItem('a', 'name', 10).isLeaf()).toBe(true);
    expect(new MMItem('b', 'name', 10, []).isLeaf()).toBe(true);
    expect(
      new MMItem('c', 'name', 10, [new MMItem('sub', 'child', 5)]).isLeaf()
    ).toBe(false);
  });

  it('getChild returns the (first) child with the corresponding id', () => {
    const children = [
      new MMItem('sub1', 'child1', 180),
      new MMItem('sub2', 'child2', 90),
      new MMItem('sub2', 'child2', 100) // This should not be allowed
    ];
    const mi = new MMItem('a', 'name', 10, children);
    expect(mi.getChild('sub1')).toBe(children[0]);
    expect(mi.getChild('sub2')).toBe(children[1]);
  });

  it('getChildrenByName returns the children with the corresponding name', () => {
    const children = [
      new MMItem('sub1', 'child1', 180),
      new MMItem('sub2', 'child2', 90),
      new MMItem('sub2', 'child2', 120) // Odd, but why not.
    ];
    const mi = new MMItem('a', 'name', 10, children);
    expect(mi.getChildrenByName('child2')).toEqual(children.slice(1));
  });

  it('getNearestChild returns the children the closest to the provided angle', () => {
    const children = [
      new MMItem('sub1', 'child1', 180),
      new MMItem('sub2', 'child2', 90),
      new MMItem('sub3', 'child3', 45),
      new MMItem('sub4', 'child3', 0)
    ];
    const mi = new MMItem('a', 'name', 10, children);
    expect(mi.getNearestChild(45)).toBe(children[2]);
    expect(mi.getNearestChild(220)).toBe(children[0]);
    expect(mi.getNearestChild(300)).toBe(children[3]);
  });

  test('getMaxDepth returns the maximum depth of the item hierarchy', () => {
    expect(new MMItem('id', 'name', 0).getMaxDepth()).toBe(0);

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
    expect(m.getMaxDepth()).toBe(3);
  });

  test('getMaxBreadth returns the maximum breadth of the item hierarchy', () => {
    expect(new MMItem('id', 'name', 0).getMaxBreadth()).toBe(0);

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
    expect(m.getMaxBreadth()).toBe(4);
  });
});

describe('createModel', () => {
  it('creates a whole hierarchy of menu items', () => {
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
    expect(m.children.map(c => c.name)).toEqual([
      'right',
      'bottom',
      'left',
      'up'
    ]);
    expect(m.children[1].children.map(c => c.name)).toEqual([
      'Sub 1',
      'Sub 2',
      'Sub 3',
      'Sub 4',
      'Sub 5',
      'Sub 6'
    ]);

    // Check that ids are all unique
    expect(
      m.children.every(c1 =>
        m.children.every(c2 => c2 === c1 || c2.id !== c1.id)
      )
    ).toBe(true);
    expect(
      m.children[1].children.every(c1 =>
        m.children[1].children.every(c2 => c2 === c1 || c2.id !== c1.id)
      )
    ).toBe(true);

    // Check that the angles are properly set up.
    expect(m.children.map(c => c.angle)).toEqual([0, 90, 180, 270]);
    expect(m.children[1].children.map(c => c.angle)).toEqual([
      0,
      45,
      90,
      135,
      180,
      225
    ]);

    // Check that the custom-id has been properly set.
    expect(m.children[1].children[1].id).toBe('custom-id');
  });
});
