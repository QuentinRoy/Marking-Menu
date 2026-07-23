import createModel, { MMItem } from './model.js';

describe('MMItem', () => {
  it('can be created properly', () => {
    const a = new MMItem('id', 'label', 10);
    expect(a.angle).toBe(10);
    expect(a.id).toBe('id');
    expect(a.label).toBe('label');
  });

  it('isLeaf checks if the item has children', () => {
    expect(new MMItem('a', 'label', 10).isLeaf()).toBe(true);
    expect(new MMItem('b', 'label', 10, { children: [] }).isLeaf()).toBe(true);
    expect(
      new MMItem('c', 'label', 10, {
        children: [new MMItem('sub', 'childLabel', 5)],
      }).isLeaf(),
    ).toBe(false);
  });

  it('isRoot checks if the item has a parent', () => {
    expect(new MMItem('id', 'label', 0).isRoot()).toBe(true);
    expect(
      new MMItem('id', 'label', 0, {
        parent: new MMItem('parentId', 'parentLabel', 0),
      }).isRoot(),
    ).toBe(false);
  });

  it('getChild returns the (first) child with the corresponding id', () => {
    const children = [
      new MMItem('sub1', 'child1', 180),
      new MMItem('sub2', 'child2', 90),
      new MMItem('sub2', 'child2', 100), // This should not be allowed
    ];
    const mi = new MMItem('a', 'name', 10, { children });
    expect(mi.getChild('sub1')).toBe(children[0]);
    expect(mi.getChild('sub2')).toBe(children[1]);
  });

  it('getChildrenByLabel returns the children with the corresponding label', () => {
    const children = [
      new MMItem('sub1', 'child1', 180),
      new MMItem('sub2', 'child2', 90),
      new MMItem('sub2', 'child2', 120), // Weird, but why not.
    ];
    const mi = new MMItem('a', 'name', 10, { children });
    expect(mi.getChildrenByLabel('child2')).toEqual(children.slice(1));
  });

  it('getNearestChild returns the children the closest to the provided angle', () => {
    const children = [
      new MMItem('sub1', 'child1', 180),
      new MMItem('sub2', 'child2', 90),
      new MMItem('sub3', 'child3', 45),
      new MMItem('sub4', 'child3', 0),
    ];
    const mi = new MMItem('a', 'name', 10, { children });
    expect(mi.getNearestChild(45)).toBe(children[2]);
    expect(mi.getNearestChild(220)).toBe(children[0]);
    expect(mi.getNearestChild(300)).toBe(children[3]);
  });

  it('getMaxDepth returns the maximum depth of the item hierarchy', () => {
    expect(new MMItem('id', 'name', 0).getMaxDepth()).toBe(0);

    const subsub4 = new MMItem('subsub4', 'subchild4', 0, {
      children: [
        new MMItem('subsubsub1', 'subsubchild1', 0),
        new MMItem('subsubsub2', 'subsubchild2', 0),
      ],
    });
    const sub1 = new MMItem('sub1', 'child1', 180, {
      children: [
        new MMItem('subsub1', 'subchild1', 180),
        new MMItem('subsub2', 'subchild2', 90),
        new MMItem('subsub3', 'subchild3', 45),
        subsub4,
      ],
    });
    const sub3 = new MMItem('sub3', 'child3', 45, {
      children: [new MMItem('subsub5', 'subchild5', 0)],
    });
    const m = new MMItem('id', 'l', 0, {
      children: [
        sub1,
        new MMItem('sub2', 'child2', 90),
        sub3,
        new MMItem('sub4', 'child3', 0),
      ],
    });
    expect(m.getMaxDepth()).toBe(3);
  });

  it('getMaxBreadth returns the maximum breadth of the item hierarchy', () => {
    expect(new MMItem('id', 'name', 0).getMaxBreadth()).toBe(0);

    const subsub4 = new MMItem('subsub4', 'subchild4', 0, {
      children: [
        new MMItem('subsubsub1', 'subsubchild1', 0),
        new MMItem('subsubsub2', 'subsubchild2', 0),
      ],
    });
    const sub1 = new MMItem('sub1', 'child1', 180, {
      children: [
        new MMItem('subsub1', 'subchild1', 180),
        new MMItem('subsub2', 'subchild2', 90),
        new MMItem('subsub3', 'subchild3', 45),
        subsub4,
      ],
    });
    const sub3 = new MMItem('sub3', 'child3', 45, {
      children: [new MMItem('subsub5', 'subchild5', 0)],
    });
    const m = new MMItem('id', 'l', 0, {
      children: [
        sub1,
        new MMItem('sub2', 'child2', 90),
        sub3,
        new MMItem('sub4', 'child3', 0),
      ],
    });
    expect(m.getMaxBreadth()).toBe(4);
  });
});

describe('createModel', () => {
  it('creates a whole hierarchy of menu items', () => {
    const m = createModel([
      { label: 'right' },
      {
        label: 'bottom',
        children: [
          { label: 'Sub 1' },
          { label: 'Sub 2', id: 'custom-id' },
          { label: 'Sub 3' },
          { label: 'Sub 4' },
          { label: 'Sub 5' },
          { label: 'Sub 6' },
        ],
      },
      { label: 'left' },
      { label: 'up' },
    ]);

    const [, bottom] = m.children;
    const [, custom] = bottom.children;

    // Check that the labels are correct.
    expect(m.children.map((c) => c.label)).toEqual([
      'right',
      'bottom',
      'left',
      'up',
    ]);
    expect(bottom.children.map((c) => c.label)).toEqual([
      'Sub 1',
      'Sub 2',
      'Sub 3',
      'Sub 4',
      'Sub 5',
      'Sub 6',
    ]);

    // Check that ids are all unique
    expect(
      m.children.every((c1) =>
        m.children.every((c2) => c2 === c1 || c2.id !== c1.id),
      ),
    ).toBe(true);
    expect(
      bottom.children.every((c1) =>
        bottom.children.every((c2) => c2 === c1 || c2.id !== c1.id),
      ),
    ).toBe(true);

    // Check that the angles are properly set up.
    expect(m.children.map((c) => c.angle)).toEqual([0, 90, 180, 270]);
    expect(bottom.children.map((c) => c.angle)).toEqual([
      0, 45, 90, 135, 180, 225,
    ]);

    // Check that the parents are properly set up
    expect(m.children.every((c) => c.parent === m)).toBe(true);
    expect(bottom.children.every((c) => c.parent === bottom)).toBe(true);

    // Check that the custom-id has been properly set.
    expect(custom.id).toBe('custom-id');
  });
});
