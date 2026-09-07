import { createModel } from './model.js';
import type { MarkingMenuItemInput } from './types.js';

/*
 `getMinAngularGap` is a real method of every model node, but it is
 deliberately absent from the public `AnyModelNode`/`ModelItem` types (see
 `recognize-mm-stroke.ts`, its only caller), so it does not show up on
 `createModel`'s return type either. The cast reaches it anyway to test the
 computation directly.
 */
const getMinAngularGap = (node: unknown): number =>
  (node as { getMinAngularGap(): number }).getMinAngularGap();

const fourItems = [
  { id: 'right', label: 'Right' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'left', label: 'Left' },
  { id: 'up', label: 'Up' },
] as const;

describe('createModel', () => {
  it('lays out four items every 90 degrees', () => {
    const menu = createModel({ items: fourItems });
    expect(menu.items.map((item) => item.angle)).toEqual([0, 90, 180, 270]);
  });

  it('spreads three items evenly around the circle', () => {
    const menu = createModel({
      items: [{ label: 'One' }, { label: 'Two' }, { label: 'Three' }],
    });
    expect(menu.items.map((item) => item.angle)).toEqual([0, 120, 240]);
  });

  it('spreads five items evenly around the circle', () => {
    const menu = createModel({
      items: [
        { label: 'One' },
        { label: 'Two' },
        { label: 'Three' },
        { label: 'Four' },
        { label: 'Five' },
      ],
    });
    expect(menu.items.map((item) => item.angle)).toEqual([
      0, 72, 144, 216, 288,
    ]);
  });

  it.each([
    { count: 6, angles: [0, 60, 120, 180, 240, 300] },
    {
      count: 7,
      angles: [
        0, 51.42857142857143, 102.85714285714286, 154.28571428571428,
        205.71428571428572, 257.14285714285717, 308.57142857142856,
      ],
    },
  ])('spreads $count items evenly around the circle', ({ count, angles }) => {
    const menu = createModel({
      items: Array.from({ length: count }, (_, index) => ({
        label: `Item ${index}`,
      })),
    });
    expect(menu.items.map((item) => item.angle)).toEqual(angles);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'builds the supported %i-item layout',
    (count) => {
      expect(() =>
        createModel({
          items: Array.from({ length: count }, (_, index) => ({
            label: `Item ${index}`,
          })),
        }),
      ).not.toThrow();
    },
  );

  it('rejects an evenly spaced level tighter than the recognizer can resolve', () => {
    expect(() =>
      createModel({
        items: Array.from({ length: 9 }, (_, index) => ({
          label: `Item ${index}`,
        })),
      }),
    ).toThrow(
      /level root has 40 degrees between items.*Increase the gap or remove items/v,
    );
  });

  it('names a crowded nested level and its spacing', () => {
    expect(() =>
      createModel({
        items: [
          {
            label: 'Parent',
            items: [
              { angle: 0, label: 'First' },
              { angle: 40, label: 'Second' },
            ],
          },
        ],
      }),
    ).toThrow(/level root > 1 has 40 degrees between items/v);
  });

  it('spaces each level from its own item count', () => {
    const menu = createModel({
      items: [
        {
          label: 'Parent',
          items: [
            { label: 'One' },
            { label: 'Two' },
            { label: 'Three' },
            { label: 'Four' },
            { label: 'Five' },
          ],
        },
        { label: 'Second' },
        { label: 'Third' },
      ],
    });
    expect(menu.items.map((item) => item.angle)).toEqual([0, 120, 240]);
    expect(menu.items[0].items.map((item) => item.angle)).toEqual([
      0, 72, 144, 216, 288,
    ]);
  });

  it('lays out eight items every 45 degrees', () => {
    const menu = createModel({
      items: [
        { label: 'Sub 1' },
        { label: 'Sub 2' },
        { label: 'Sub 3' },
        { label: 'Sub 4' },
        { label: 'Sub 5' },
        { label: 'Sub 6' },
        { label: 'Sub 7' },
        { label: 'Sub 8' },
      ],
    });
    expect(menu.items.map((item) => item.angle)).toEqual([
      0, 45, 90, 135, 180, 225, 270, 315,
    ]);
  });

  it('keeps stated angles at every level', () => {
    const menu = createModel({
      items: [
        {
          angle: 45,
          label: 'Parent',
          items: [
            { angle: 20, label: 'First' },
            { label: 'Free' },
            { angle: 140, label: 'Last' },
          ],
        },
        { label: 'Other' },
      ],
    });

    expect(menu.items.map((item) => item.angle)).toEqual([45, 225]);
    expect(menu.items[0].items.map((item) => item.angle)).toEqual([
      20, 80, 140,
    ]);
  });

  it('spreads free items across each stated-angle gap', () => {
    const menu = createModel({
      items: [
        { angle: 0, label: 'First' },
        { label: 'Second' },
        { label: 'Third' },
        { angle: 180, label: 'Fourth' },
        { label: 'Fifth' },
      ],
    });

    expect(menu.items.map((item) => item.angle)).toEqual([
      0, 60, 120, 180, 270,
    ]);
  });

  it('rotates an even circle around one stated angle', () => {
    const menu = createModel({
      items: [
        { label: 'First' },
        { label: 'Second' },
        { angle: 90, label: 'Third' },
        { label: 'Fourth' },
      ],
    });

    expect(menu.items.map((item) => item.angle)).toEqual([270, 0, 90, 180]);
  });

  it('wraps stated angles while keeping listing order clockwise', () => {
    const menu = createModel({
      items: [
        { angle: 270, label: 'First' },
        { label: 'Second' },
        { angle: 0, label: 'Third' },
        { angle: 90, label: 'Fourth' },
      ],
    });

    expect(menu.items.map((item) => item.angle)).toEqual([270, 315, 0, 90]);
    for (const item of menu.items) {
      expect(item.angle).toBeGreaterThanOrEqual(0);
      expect(item.angle).toBeLessThan(360);
    }
  });

  it('keeps the ids and the labels of the items, at every level', () => {
    const menu = createModel({
      items: [
        { id: 'right', label: 'Right' },
        {
          id: 'bottom',
          label: 'Bottom',
          items: [
            { id: 'sub-1', label: 'Sub 1' },
            { id: 'sub-2', label: 'Sub 2' },
          ],
        },
      ],
    });
    expect(menu.items.map((item) => item.id)).toEqual(['right', 'bottom']);
    expect(menu.items.map((item) => item.label)).toEqual(['Right', 'Bottom']);
    expect(menu.items[1].items.map((item) => item.id)).toEqual([
      'sub-1',
      'sub-2',
    ]);
    expect(menu.items[1].items.map((item) => item.label)).toEqual([
      'Sub 1',
      'Sub 2',
    ]);
  });

  it('leaves the id of an item described without one undefined', () => {
    const menu = createModel({ items: [{ label: 'Right' }] });
    expect(menu.items[0].id).toBeUndefined();
  });

  it('marks the items without sub-items as leaves', () => {
    const menu = createModel({
      items: [
        { id: 'leaf', label: 'Leaf' },
        { id: 'menu', label: 'Menu', items: [{ label: 'Sub 1' }] },
      ],
    });
    expect(menu.isLeaf).toBe(false);
    expect(menu.items[0].isLeaf).toBe(true);
    expect(menu.items[1].isLeaf).toBe(false);
    expect(menu.items[1].items[0].isLeaf).toBe(true);
  });

  it('marks the root, and only the root, as the root', () => {
    const menu = createModel({
      items: [{ id: 'menu', label: 'Menu', items: [{ label: 'Sub 1' }] }],
    });
    expect(menu.isRoot).toBe(true);
    expect(menu.items[0].isRoot).toBe(false);
    expect(menu.items[0].items[0].isRoot).toBe(false);
  });

  it('gives every item a reference back to its parent', () => {
    const menu = createModel({
      items: [
        {
          id: 'menu',
          label: 'Menu',
          items: [{ id: 'sub-1', label: 'Sub 1' }],
        },
        { id: 'right', label: 'Right' },
      ],
    });
    expect(menu.items[0].parent).toBe(menu);
    expect(menu.items[0].items[0].parent).toBe(menu.items[0]);
    expect(menu.items[1].parent).toBe(menu);
  });

  it('has no parent at the root', () => {
    const menu = createModel({ items: [] });
    expect(menu.parent).toBeNull();
  });

  it('retrieves a direct sub-item by its id', () => {
    const menu = createModel({ items: fourItems });
    expect(menu.getChild('left')).toBe(menu.items[2]);
    expect(menu.getChild('left').label).toBe('Left');
  });

  it('retrieves every direct sub-item with a given label', () => {
    const menu = createModel({
      items: [
        { id: 'a', label: 'Same' },
        { id: 'b', label: 'Other' },
        { id: 'c', label: 'Same' },
      ],
    });
    expect(menu.getChildrenByLabel('Same')).toEqual([
      menu.items[0],
      menu.items[2],
    ]);
    expect(menu.getChildrenByLabel('None')).toEqual([]);
  });

  it('retrieves the sub-item the closest to an angle', () => {
    const menu = createModel({ items: fourItems });
    expect(menu.getNearestChild(0)).toBe(menu.items[0]);
    expect(menu.getNearestChild(100)).toBe(menu.items[1]);
    expect(menu.getNearestChild(220)).toBe(menu.items[2]);
  });

  it('compares the angles across the 0/360 boundary', () => {
    const menu = createModel({ items: fourItems });
    expect(menu.getNearestChild(350)).toBe(menu.items[0]);
    expect(menu.getNearestChild(-100)).toBe(menu.items[3]);
  });

  it('has no sub-item to retrieve on a leaf', () => {
    const menu = createModel({ items: [{ id: 'leaf', label: 'Leaf' }] });
    expect(menu.getChild('leaf').getNearestChild(0)).toBeNull();
  });

  it('computes the maximum depth of the menu', () => {
    const menu = createModel({
      items: [
        { label: 'Right' },
        {
          label: 'Bottom',
          items: [
            { label: 'Sub 1' },
            { label: 'Sub 2', items: [{ label: 'Sub sub 1' }] },
          ],
        },
      ],
    });
    expect(menu.getMaxDepth()).toBe(3);
    expect(menu.items[0].getMaxDepth()).toBe(0);
    expect(menu.items[1].getMaxDepth()).toBe(2);
  });

  it('computes the maximum breadth of the menu', () => {
    const menu = createModel({
      items: [
        { label: 'Right' },
        {
          label: 'Bottom',
          items: [
            { label: 'Sub 1' },
            { label: 'Sub 2' },
            { label: 'Sub 3' },
            { label: 'Sub 4' },
          ],
        },
      ],
    });
    expect(menu.getMaxBreadth()).toBe(4);
    expect(menu.items[0].getMaxBreadth()).toBe(0);
    expect(menu.items[1].getMaxBreadth()).toBe(4);
  });

  it('accepts a menu without any item', () => {
    const menu = createModel({ items: [] });
    expect(menu.items).toEqual([]);
    expect(menu.isRoot).toBe(true);
    expect(menu.isLeaf).toBe(true);
    expect(menu.getNearestChild(0)).toBeNull();
    expect(menu.getChildrenByLabel('Anything')).toEqual([]);
    expect(menu.getMaxDepth()).toBe(0);
    expect(menu.getMaxBreadth()).toBe(0);
  });

  it('finds the smallest angular gap of an evenly spaced menu', () => {
    const menu = createModel({ items: fourItems });
    expect(getMinAngularGap(menu)).toBe(90);
  });

  it('finds the smallest angular gap across every level, not just the top one', () => {
    const menu = createModel({
      items: [
        { label: 'Right' },
        {
          label: 'Bottom',
          items: [
            { label: 'Sub 1' },
            { label: 'Sub 2' },
            { label: 'Sub 3' },
            { label: 'Sub 4' },
            { label: 'Sub 5' },
          ],
        },
      ],
    });
    expect(getMinAngularGap(menu)).toBe(72);
    expect(getMinAngularGap(menu.items[1])).toBe(72);
  });

  it('reports no gap for a level with fewer than two items', () => {
    const menu = createModel({
      items: [{ label: 'Only one', items: [{ label: 'Sub 1' }] }],
    });
    expect(getMinAngularGap(menu)).toBe(Infinity);
    expect(getMinAngularGap(menu.items[0])).toBe(Infinity);
  });

  it('freezes the item lists, at every level', () => {
    const menu = createModel({
      items: [{ id: 'menu', label: 'Menu', items: [{ label: 'Sub 1' }] }],
    });
    expect(Object.isFrozen(menu.items)).toBe(true);
    expect(Object.isFrozen(menu.items[0].items)).toBe(true);
    expect(Object.isFrozen(menu.items[0].items[0].items)).toBe(true);
  });

  it('does not let the items be mutated', () => {
    const menu = createModel({ items: [{ id: 'right', label: 'Right' }] });
    expect(() => {
      // @ts-expect-error, exactly what is being checked at runtime.
      menu.items[0].label = 'Mutated';
    }).toThrow(TypeError);
    expect(menu.items[0].label).toBe('Right');
  });

  it.each([NaN, Infinity, -Infinity])(
    'rejects the non-finite angle %p',
    (angle) => {
      expect(() =>
        createModel({ items: [{ angle, label: 'Invalid' }] }),
      ).toThrow(/angles must be finite/v);
    },
  );

  it('rejects two items at the same angle', () => {
    expect(() =>
      createModel({
        items: [
          { angle: 0, label: 'First' },
          { angle: 360, label: 'Second' },
        ],
      }),
    ).toThrow(/different angles/v);
  });

  it('rejects a repeated non-first angle', () => {
    expect(() =>
      createModel({
        items: [
          { angle: 10, label: 'First' },
          { angle: 50, label: 'Second' },
          { angle: 50, label: 'Third' },
        ],
      }),
    ).toThrow(/different angles/v);
  });

  it('rejects stated angles that need more than one turn', () => {
    expect(() =>
      createModel({
        items: [
          { angle: 0, label: 'First' },
          { angle: 270, label: 'Second' },
          { angle: 180, label: 'Third' },
        ],
      }),
    ).toThrow(/more than one full turn/v);
  });

  it('rejects two items sharing the same id', () => {
    const siblings: MarkingMenuItemInput[] = [
      { id: 'same', label: 'First' },
      { id: 'same', label: 'Second' },
    ];
    expect(() => createModel({ items: siblings })).toThrow(
      /"same" is used more than once/v,
    );

    const distantRelatives: MarkingMenuItemInput[] = [
      { id: 'menu-1', label: 'Menu 1', items: [{ id: 'same', label: 'A' }] },
      { id: 'menu-2', label: 'Menu 2', items: [{ id: 'same', label: 'B' }] },
    ];
    expect(() => createModel({ items: distantRelatives })).toThrow(
      /"same" is used more than once/v,
    );
  });

  it('does not mistake two items described without an id for duplicates', () => {
    const items: MarkingMenuItemInput[] = [
      { label: 'First' },
      { label: 'Second', items: [{ label: 'Sub 1' }] },
    ];
    expect(() => createModel({ items })).not.toThrow();
  });

  it('behaves the same on a menu built at runtime', () => {
    const items: MarkingMenuItemInput[] = [
      { id: 'right', label: 'Right' },
      { label: 'Bottom', items: [{ id: 'sub-1', label: 'Sub 1' }] },
    ];
    const dynamic = createModel({ items });
    const literal = createModel({
      items: [
        { id: 'right', label: 'Right' },
        { label: 'Bottom', items: [{ id: 'sub-1', label: 'Sub 1' }] },
      ],
    });

    expect(dynamic).toEqual(literal);
    expect(dynamic.getChild('right')?.angle).toBe(0);
    expect(dynamic.getChild('unknown')).toBeNull();
    expect(dynamic.getNearestChild(90)?.label).toBe('Right');
    expect(dynamic.getMaxDepth()).toBe(2);
  });
});
