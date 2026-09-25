import { type OutputsOf } from 'totorobot';
import { describe, expectTypeOf, it } from 'vitest';
import type { MenuLayoutModel } from '../../layout/menu.js';
import { createModel } from '../../model.js';
import type { MarkingMenuItemInput } from '../../types.js';
import { type navigationMachine } from '../machine.js';
import type { EngineModelMenu, EngineModelRoot } from '../model-node.js';
import type { LayoutRenderer } from '../renderer.js';

const literalModel = createModel({
  items: [
    {
      id: 'menu',
      label: 'Menu',
      items: [{ id: 'leaf', label: 'Leaf' }],
    },
  ],
} as const);

declare const dynamicItems: MarkingMenuItemInput[];
const dynamicModel = createModel({ items: dynamicItems });

type Outputs = OutputsOf<typeof navigationMachine>;

describe('erased engine model', () => {
  it('accepts literal and dynamic public models', () => {
    expectTypeOf(literalModel).toExtend<EngineModelRoot>();
    expectTypeOf(dynamicModel).toExtend<EngineModelRoot>();
  });

  it('retains the renderer layout contract', () => {
    expectTypeOf<EngineModelMenu>().toExtend<MenuLayoutModel>();
  });

  it('passes machine layout announcements directly to the renderer', () => {
    expectTypeOf<Outputs['layout']>().toExtend<
      Parameters<LayoutRenderer['render']>[0]
    >();
  });
});
