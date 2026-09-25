import { describe, expectTypeOf, it } from 'vitest';
import { createModel } from '../../model.js';
import {
  findItem,
  recognizeMarkingMenuStroke,
  walkModel,
} from '../recognize-mm-stroke.js';

const model = createModel({
  items: [
    {
      id: 'menu',
      label: 'Menu',
      items: [{ id: 'leaf', label: 'Leaf' }],
    },
  ],
} as const);

const segments = [{ angle: 0, length: 1 }];

describe('recognizer type contracts', () => {
  it('returns item paths without the root', () => {
    const walked = walkModel({ model, segments });
    const found = findItem({ model, segments });

    expectTypeOf<NonNullable<typeof walked>[number]['id']>().toEqualTypeOf<
      'menu' | 'leaf'
    >();
    expectTypeOf<NonNullable<typeof found>[number]['id']>().toEqualTypeOf<
      'menu' | 'leaf'
    >();
  });

  it('keeps leaf and menu recognition narrow', () => {
    const leaf = recognizeMarkingMenuStroke([], model);
    const menu = recognizeMarkingMenuStroke([], model, { requireMenu: true });

    expectTypeOf(leaf?.isLeaf).toEqualTypeOf<true | undefined>();
    expectTypeOf(menu?.isLeaf).toEqualTypeOf<false | undefined>();
  });
});
