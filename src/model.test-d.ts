import { describe, it, expectTypeOf } from 'vitest';
import createModel from './model.js';
import type { MarkingMenuItemInput } from './types.js';

/*
 Type level tests: they assert what the type system knows about a model built
 from a literal menu description. They are checked by `tsc`, not run.
 */

// Ids and labels the type system only knows as strings.
declare const dynamicId: string;
declare const dynamicLabel: string;

const menu = createModel({
  items: [
    { id: 'right', label: 'Right' },
    {
      id: 'bottom',
      label: 'Bottom',
      items: [{ id: 'sub-1', label: 'Sub 1' }, { label: 'Sub 2' }],
    },
    { label: 'Left' },
  ],
});

describe('createModel', () => {
  it('narrows the ids and the labels of the items, at every level', () => {
    expectTypeOf(menu.items[0].id).toEqualTypeOf<'right'>();
    expectTypeOf(menu.items[0].label).toEqualTypeOf<'Right'>();
    expectTypeOf(menu.items[1].items[0].id).toEqualTypeOf<'sub-1'>();
    expectTypeOf(menu.items[1].items[0].label).toEqualTypeOf<'Sub 1'>();
  });

  it('types the id of an item described without one as `undefined`', () => {
    expectTypeOf(menu.items[2].id).toEqualTypeOf<undefined>();
    expectTypeOf(menu.items[1].items[1].id).toEqualTypeOf<undefined>();
  });

  it('keeps the angles plain numbers', () => {
    expectTypeOf(menu.items[0].angle).toEqualTypeOf<number>();
  });

  it('knows whether a node is a leaf', () => {
    expectTypeOf(menu.isLeaf).toEqualTypeOf<false>();
    expectTypeOf(menu.items[0].isLeaf).toEqualTypeOf<true>();
    expectTypeOf(menu.items[1].isLeaf).toEqualTypeOf<false>();
    expectTypeOf(menu.items[1].items[0].isLeaf).toEqualTypeOf<true>();
  });

  it('knows whether a node is the root', () => {
    expectTypeOf(menu.isRoot).toEqualTypeOf<true>();
    expectTypeOf(menu.items[0].isRoot).toEqualTypeOf<false>();
  });

  it('resolves getChild to the very item bearing the id', () => {
    expectTypeOf(menu.getChild('bottom').label).toEqualTypeOf<'Bottom'>();
    expectTypeOf(
      menu.getChild('bottom').getChild('sub-1').label,
    ).toEqualTypeOf<'Sub 1'>();
  });

  it('returns a non-nullable item from getChild', () => {
    expectTypeOf(menu.getChild('right')).not.toBeNullable();
  });

  it('rejects the ids of items that are not siblings', () => {
    // @ts-expect-error -- `sub-1` is a child of `bottom`, not of the root.
    menu.getChild('sub-1');
    // @ts-expect-error -- `bottom` is the parent of `sub-1`, not its sibling.
    menu.getChild('bottom').getChild('bottom');
  });

  it('rejects unknown ids', () => {
    // @ts-expect-error -- no item bears this id.
    menu.getChild('typo');
  });

  it('does not make id-less items addressable', () => {
    // @ts-expect-error -- the third item was described without an id.
    menu.getChild('Left');
  });

  it('makes getChild uncallable on a leaf', () => {
    // @ts-expect-error -- a leaf has no child to look for.
    menu.items[0].getChild('right');
  });

  it('keeps getChildrenByLabel loose', () => {
    expectTypeOf(menu.getChildrenByLabel(dynamicLabel)).toEqualTypeOf<
      Array<(typeof menu.items)[number]>
    >();
  });

  it('never returns null from getNearestChild on a menu, always on a leaf', () => {
    expectTypeOf(menu.getNearestChild(0)).not.toBeNullable();
    expectTypeOf(menu.items[0].getNearestChild(0)).toEqualTypeOf<null>();
  });

  it('resolves the depth and the breadth of a leaf to 0', () => {
    expectTypeOf(menu.items[0].getMaxDepth()).toEqualTypeOf<0>();
    expectTypeOf(menu.items[0].getMaxBreadth()).toEqualTypeOf<0>();
    expectTypeOf(menu.getMaxDepth()).toEqualTypeOf<number>();
    expectTypeOf(menu.getMaxBreadth()).toEqualTypeOf<number>();
  });

  it('does not need `as const` to narrow', () => {
    // The `const` type parameter narrows the description on its own: the
    // literal above is a plain object literal, and this one is too.
    const other = createModel({ items: [{ id: 'only', label: 'Only' }] });
    expectTypeOf(other.getChild('only').id).toEqualTypeOf<'only'>();
  });

  it('does not let an unknown id collapse the ids of its siblings', () => {
    const mixed = createModel({
      items: [
        { id: dynamicId, label: 'Dynamic' },
        { id: 'static', label: 'Static' },
      ],
    });
    expectTypeOf(mixed.getChild('static').label).toEqualTypeOf<'Static'>();
    // @ts-expect-error -- the first id is not known statically.
    mixed.getChild('dynamic');
  });

  it('rejects sibling items sharing the same id', () => {
    // @ts-expect-error -- two items share the id `duplicate`.
    createModel({
      items: [
        { id: 'duplicate', label: 'First' },
        { id: 'duplicate', label: 'Second' },
      ],
    });
  });

  it('rejects items sharing the same id anywhere in the menu', () => {
    // @ts-expect-error -- the duplicate is nested one level down.
    createModel({
      items: [
        {
          id: 'menu',
          label: 'Menu',
          items: [
            { id: 'duplicate', label: 'First' },
            { id: 'duplicate', label: 'Second' },
          ],
        },
      ],
    });

    // @ts-expect-error -- `same` is used in two different menus.
    createModel({
      items: [
        { id: 'menu-1', label: 'Menu 1', items: [{ id: 'same', label: 'A' }] },
        { id: 'menu-2', label: 'Menu 2', items: [{ id: 'same', label: 'B' }] },
      ],
    });

    // @ts-expect-error -- a sub-item repeats the id of an item above it.
    createModel({
      items: [
        { id: 'menu', label: 'Menu', items: [{ id: 'menu', label: 'Sub' }] },
      ],
    });
  });

  it('accepts ids that are unique across the whole menu', () => {
    const namespaced = createModel({
      items: [
        {
          id: 'menu-1',
          label: 'Menu 1',
          items: [{ id: 'menu-1-a', label: 'A' }],
        },
        {
          id: 'menu-2',
          label: 'Menu 2',
          items: [{ id: 'menu-2-a', label: 'B' }],
        },
      ],
    });
    expectTypeOf(
      namespaced.getChild('menu-2').getChild('menu-2-a').label,
    ).toEqualTypeOf<'B'>();
  });

  it('requires a label on every item', () => {
    // @ts-expect-error -- the item has no label.
    createModel({ items: [{ id: 'no-label' }] });
    // @ts-expect-error -- the nested item has no label.
    createModel({ items: [{ label: 'Menu', items: [{ id: 'no-label' }] }] });
  });

  it('accepts an empty menu, whose root is both a leaf and the root', () => {
    const empty = createModel({ items: [] });
    expectTypeOf(empty.isLeaf).toEqualTypeOf<true>();
    expectTypeOf(empty.isRoot).toEqualTypeOf<true>();
    expectTypeOf(empty.getNearestChild(0)).toEqualTypeOf<null>();
    expectTypeOf(empty.getMaxDepth()).toEqualTypeOf<0>();
    // @ts-expect-error -- there is no child to get.
    empty.getChild('anything');
  });

  it('degrades gracefully when the items are not statically known', () => {
    const dynamicItems: MarkingMenuItemInput[] = [
      { id: 'a', label: 'A' },
      { label: 'B' },
    ];
    const dynamic = createModel({ items: dynamicItems });

    expectTypeOf(dynamic.isLeaf).toEqualTypeOf<boolean>();
    expectTypeOf(dynamic.isRoot).toEqualTypeOf<true>();
    // Any string is accepted, and the item may not be there.
    expectTypeOf(dynamic.getChild('whatever')).toBeNullable();
    expectTypeOf(dynamic.getNearestChild(0)).toBeNullable();
    expectTypeOf(dynamic.getMaxDepth()).toEqualTypeOf<number>();
  });
});
