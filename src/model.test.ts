import createModel from './model.js';
import type { MarkingMenuItemInput } from './types.js';

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

  it('lays out more than four items every 45 degrees', () => {
    const menu = createModel({
      items: [
        { label: 'Sub 1' },
        { label: 'Sub 2' },
        { label: 'Sub 3' },
        { label: 'Sub 4' },
        { label: 'Sub 5' },
        { label: 'Sub 6' },
      ],
    });
    expect(menu.items.map((item) => item.angle)).toEqual([
      0, 45, 90, 135, 180, 225,
    ]);
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
      // @ts-expect-error -- exactly what is being checked at runtime.
      menu.items[0].label = 'Mutated';
    }).toThrow(TypeError);
    expect(menu.items[0].label).toBe('Right');
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
    expect(dynamic.getNearestChild(90)?.label).toBe('Bottom');
    expect(dynamic.getMaxDepth()).toBe(2);
  });
});
