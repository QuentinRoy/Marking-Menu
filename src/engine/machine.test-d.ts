import type { OutputsOf, StatesOf } from 'totorobot';
import { describe, expectTypeOf, it } from 'vitest';
import type {
  MarkingMenuCancelEvent,
  MarkingMenuChangeEvent,
  MarkingMenuMoveEvent,
  MarkingMenuOpenEvent,
  MarkingMenuSelectEvent,
  MarkingMenuStartEvent,
} from '../events.js';
import type { AnyModelNode } from '../types.js';
import { type navigationMachine, type NavigationOptions } from './machine.js';

/*
 Type-level tests: `StatesOf<>`/`OutputsOf<>` resolving over a generic model
 was the type plumbing #219 called out as the thing most likely to fight
 back — `ModelMenus<M>`/`ModelLeaves<M>` collapse to `never` the moment `M` is
 a concrete type rather than a deferred generic parameter, which is exactly
 why `navigationMachine` erases every model-shaped field to `AnyModelNode`
 instead of instantiating them at a real `M`. Checked by `tsc`, not run.
 */

type States = StatesOf<typeof navigationMachine>;
type Outputs = OutputsOf<typeof navigationMachine>;

describe('StatesOf<typeof navigationMachine>', () => {
  it('names exactly the four phases', () => {
    expectTypeOf<keyof States>().toEqualTypeOf<
      'idle' | 'startup' | 'expert' | 'novice'
    >();
  });

  it('threads deps through every phase', () => {
    expectTypeOf<States['idle']>().toEqualTypeOf<{
      readonly deps: {
        readonly model: AnyModelNode;
        readonly options: NavigationOptions;
      };
    }>();
    expectTypeOf<States['startup']['deps']>().toEqualTypeOf<
      States['idle']['deps']
    >();
    expectTypeOf<States['expert']['deps']>().toEqualTypeOf<
      States['idle']['deps']
    >();
    expectTypeOf<States['novice']['deps']>().toEqualTypeOf<
      States['idle']['deps']
    >();
  });

  it('carries a stroke everywhere but idle, and a menu only in novice', () => {
    expectTypeOf<States['idle']>().not.toHaveProperty('stroke');
    expectTypeOf<States['startup']['stroke']>().toEqualTypeOf<
      States['expert']['stroke']
    >();
    expectTypeOf<States['startup']>().not.toHaveProperty('menu');
    expectTypeOf<States['expert']>().not.toHaveProperty('menu');
    expectTypeOf<States['novice']['menu']>().toEqualTypeOf<AnyModelNode>();
  });

  it("is generic-safe: a caller's own model still threads through `deps.model`", () => {
    // The exact pattern `runtime.ts` relies on: a real `M` is narrower than
    // `AnyModelNode`, so it is always assignable into the erased `deps.model`
    // this file declares, for any `M` a caller instantiates `createRuntime`
    // with — never just the fixture model this suite happens to use.
    const carryDeps = <M extends AnyModelNode>(model: M): States['idle'] => ({
      deps: {
        model,
        options: { movementsThreshold: 5, noviceDwellingTime: 1 },
      },
    });
    expectTypeOf(carryDeps).toBeFunction();
  });
});

describe('OutputsOf<typeof navigationMachine>', () => {
  it('is the flat eight: six public events plus the two internal announcements', () => {
    expectTypeOf<keyof Outputs>().toEqualTypeOf<
      | 'start'
      | 'move'
      | 'open'
      | 'change'
      | 'select'
      | 'cancel'
      | 'layout'
      | 'feedback'
    >();
  });

  it('matches the public event map exactly, over the same erased model', () => {
    expectTypeOf<Outputs['start']>().toEqualTypeOf<MarkingMenuStartEvent>();
    expectTypeOf<Outputs['move']>().toEqualTypeOf<
      MarkingMenuMoveEvent<AnyModelNode>
    >();
    expectTypeOf<Outputs['open']>().toEqualTypeOf<
      MarkingMenuOpenEvent<AnyModelNode>
    >();
    expectTypeOf<Outputs['change']>().toEqualTypeOf<
      MarkingMenuChangeEvent<AnyModelNode>
    >();
    expectTypeOf<Outputs['select']>().toEqualTypeOf<
      MarkingMenuSelectEvent<AnyModelNode>
    >();
    expectTypeOf<Outputs['cancel']>().toEqualTypeOf<
      MarkingMenuCancelEvent<AnyModelNode>
    >();
  });
});
