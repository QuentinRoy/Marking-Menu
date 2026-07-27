import { describe, it, expectTypeOf } from 'vitest';
import { createModel } from '../model.js';
import type { MenuLayoutModel } from './menu.js';

/*
 Type level test: it asserts that a real model node is assignable to
 `MenuLayoutModel`, i.e. that the layout can actually consume what the model
 produces. It is checked by `tsc`, not run.
 */

describe('MenuLayoutModel', () => {
  it('accepts a real model node', () => {
    const model = createModel({
      items: [{ label: 'Right' }, { id: 'bottom', label: 'Bottom' }],
    });
    expectTypeOf(model).toExtend<MenuLayoutModel>();
  });
});
