import createModel, { MMItem } from './model.js';

describe('MMItem', () => {
  it('can be created properly', () => {
    const a = new MMItem({ id: 'id', label: 'label', angle: 10 });
    expect(a.angle).toBe(10);
    expect(a.id).toBe('id');
    expect(a.label).toBe('label');
  });

  it('isLeaf checks if the item has children', () => {
    expect(new MMItem({ id: 'a', label: 'label', angle: 10 }).isLeaf()).toBe(
      true,
    );
    expect(
      new MMItem({ id: 'b', label: 'label', angle: 10, children: [] }).isLeaf(),
    ).toBe(true);
    expect(
      new MMItem({
        id: 'c',
        label: 'label',
        angle: 10,
        children: [new MMItem({ id: 'sub', label: 'childLabel', angle: 5 })],
      }).isLeaf(),
    ).toBe(false);
  });

  it('isRoot checks if the item has a parent', () => {
    expect(new MMItem({ id: 'id', label: 'label', angle: 0 }).isRoot()).toBe(
      true,
    );
    expect(
      new MMItem({
        id: 'id',
        label: 'label',
        angle: 0,
        parent: new MMItem({ id: 'parentId', label: 'parentLabel', angle: 0 }),
      }).isRoot(),
    ).toBe(false);
  });

  it('getChild returns the (first) child with the corresponding id', () => {
    const children = [
      new MMItem({ id: 'sub1', label: 'child1', angle: 180 }),
      new MMItem({ id: 'sub2', label: 'child2', angle: 90 }),
      new MMItem({ id: 'sub2', label: 'child2', angle: 100 }), // This should not be allowed
    ];
    const mi = new MMItem({ id: 'a', label: 'name', angle: 10, children });
    expect(mi.getChild('sub1')).toBe(children[0]);
    expect(mi.getChild('sub2')).toBe(children[1]);
  });

  it('getChildrenByLabel returns the children with the corresponding label', () => {
    const children = [
      new MMItem({ id: 'sub1', label: 'child1', angle: 180 }),
      new MMItem({ id: 'sub2', label: 'child2', angle: 90 }),
      new MMItem({ id: 'sub2', label: 'child2', angle: 120 }), // Weird, but why not.
    ];
    const mi = new MMItem({ id: 'a', label: 'name', angle: 10, children });
    expect(mi.getChildrenByLabel('child2')).toEqual(children.slice(1));
  });

  it('getNearestChild returns the children the closest to the provided angle', () => {
    const children = [
      new MMItem({ id: 'sub1', label: 'child1', angle: 180 }),
      new MMItem({ id: 'sub2', label: 'child2', angle: 90 }),
      new MMItem({ id: 'sub3', label: 'child3', angle: 45 }),
      new MMItem({ id: 'sub4', label: 'child3', angle: 0 }),
    ];
    const mi = new MMItem({ id: 'a', label: 'name', angle: 10, children });
    expect(mi.getNearestChild(45)).toBe(children[2]);
    expect(mi.getNearestChild(220)).toBe(children[0]);
    expect(mi.getNearestChild(300)).toBe(children[3]);
  });

  it('getMaxDepth returns the maximum depth of the item hierarchy', () => {
    expect(
      new MMItem({ id: 'id', label: 'name', angle: 0 }).getMaxDepth(),
    ).toBe(0);

    const subsub4 = new MMItem({
      id: 'subsub4',
      label: 'subchild4',
      angle: 0,
      children: [
        new MMItem({ id: 'subsubsub1', label: 'subsubchild1', angle: 0 }),
        new MMItem({ id: 'subsubsub2', label: 'subsubchild2', angle: 0 }),
      ],
    });
    const sub1 = new MMItem({
      id: 'sub1',
      label: 'child1',
      angle: 180,
      children: [
        new MMItem({ id: 'subsub1', label: 'subchild1', angle: 180 }),
        new MMItem({ id: 'subsub2', label: 'subchild2', angle: 90 }),
        new MMItem({ id: 'subsub3', label: 'subchild3', angle: 45 }),
        subsub4,
      ],
    });
    const sub3 = new MMItem({
      id: 'sub3',
      label: 'child3',
      angle: 45,
      children: [new MMItem({ id: 'subsub5', label: 'subchild5', angle: 0 })],
    });
    const m = new MMItem({
      id: 'id',
      label: 'l',
      angle: 0,
      children: [
        sub1,
        new MMItem({ id: 'sub2', label: 'child2', angle: 90 }),
        sub3,
        new MMItem({ id: 'sub4', label: 'child3', angle: 0 }),
      ],
    });
    expect(m.getMaxDepth()).toBe(3);
  });

  it('getMaxBreadth returns the maximum breadth of the item hierarchy', () => {
    expect(
      new MMItem({ id: 'id', label: 'name', angle: 0 }).getMaxBreadth(),
    ).toBe(0);

    const subsub4 = new MMItem({
      id: 'subsub4',
      label: 'subchild4',
      angle: 0,
      children: [
        new MMItem({ id: 'subsubsub1', label: 'subsubchild1', angle: 0 }),
        new MMItem({ id: 'subsubsub2', label: 'subsubchild2', angle: 0 }),
      ],
    });
    const sub1 = new MMItem({
      id: 'sub1',
      label: 'child1',
      angle: 180,
      children: [
        new MMItem({ id: 'subsub1', label: 'subchild1', angle: 180 }),
        new MMItem({ id: 'subsub2', label: 'subchild2', angle: 90 }),
        new MMItem({ id: 'subsub3', label: 'subchild3', angle: 45 }),
        subsub4,
      ],
    });
    const sub3 = new MMItem({
      id: 'sub3',
      label: 'child3',
      angle: 45,
      children: [new MMItem({ id: 'subsub5', label: 'subchild5', angle: 0 })],
    });
    const m = new MMItem({
      id: 'id',
      label: 'l',
      angle: 0,
      children: [
        sub1,
        new MMItem({ id: 'sub2', label: 'child2', angle: 90 }),
        sub3,
        new MMItem({ id: 'sub4', label: 'child3', angle: 0 }),
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
