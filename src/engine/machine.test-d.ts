import { machine, type, type OutputsOf, type StatesOf } from 'totorobot';
import { describe, expectTypeOf, it } from 'vitest';
import type {
  MarkingMenuCancelEvent,
  MarkingMenuChangeEvent,
  MarkingMenuMoveEvent,
  MarkingMenuOpenEvent,
  MarkingMenuSelectEvent,
  MarkingMenuStartEvent,
} from '../events.js';
import type { MarkingMenuModel } from '../model.js';
import type { AnyModelNode, ModelLeaves, ModelMenus } from '../types.js';
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

  it('threads model and options through every phase', () => {
    // `toEqualTypeOf` on the whole `States['idle']` object mistypes as a
    // mismatch here: `expect-type` gets confused comparing an intersection
    // against `AnyModelNode`'s `this`-typed `getNearestChild`, once that
    // intersection arrives through `MachineStates`' mapped type rather than
    // as a literal object type. Checking the keys and each field separately
    // sidesteps it without losing what the assertion is for.
    expectTypeOf<keyof States['idle']>().toEqualTypeOf<'model' | 'options'>();
    expectTypeOf<States['idle']['model']>().toEqualTypeOf<AnyModelNode>();
    expectTypeOf<
      States['idle']['options']
    >().toEqualTypeOf<NavigationOptions>();
    expectTypeOf<States['startup']['model']>().toEqualTypeOf<
      States['idle']['model']
    >();
    expectTypeOf<States['startup']['options']>().toEqualTypeOf<
      States['idle']['options']
    >();
    expectTypeOf<States['expert']['model']>().toEqualTypeOf<
      States['idle']['model']
    >();
    expectTypeOf<States['expert']['options']>().toEqualTypeOf<
      States['idle']['options']
    >();
    expectTypeOf<States['novice']['model']>().toEqualTypeOf<
      States['idle']['model']
    >();
    expectTypeOf<States['novice']['options']>().toEqualTypeOf<
      States['idle']['options']
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

  it("is generic-safe: a caller's own model still threads through `model`", () => {
    // The exact pattern `runtime.ts` relies on: a real `M` is narrower than
    // `AnyModelNode`, so it is always assignable into the erased `model`
    // field this file declares, for any `M` a caller instantiates
    // `createRuntime` with — never just the fixture model this suite happens
    // to use.
    const carryModel = <M extends AnyModelNode>(model: M): States['idle'] => ({
      model,
      options: {
        movementsThreshold: 5,
        noviceDwellingTime: 1,
        minSelectionDist: 40,
        minMenuSelectionDist: 80,
        submenuOpeningDelay: 1,
      },
    });
    expectTypeOf(carryModel).toBeFunction();
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

// The type-plumbing spike: a machine kept genuinely generic over `M`, built
// only to prove `StatesOf<>`/`OutputsOf<>` preserve it rather than resolving
// it early. That's the reason `navigationMachine` above erases every
// model-shaped field to `AnyModelNode` instead of keeping a real `M`: this
// probe never gets erased, and never gets started either, since this file is
// type-checked only and never run.
function genericProbe<M extends AnyModelNode>() {
  return machine({
    states: type<{
      idle: undefined;
      open: { readonly menu: ModelMenus<M> };
    }>(),
    outputs: type<{ selected: { readonly leaf: ModelLeaves<M> } }>(),
    initial: 'idle',
    transitions: {},
  });
}

type ProbeStates<M extends AnyModelNode> = StatesOf<
  ReturnType<typeof genericProbe<M>>
>;
type ProbeOutputs<M extends AnyModelNode> = OutputsOf<
  ReturnType<typeof genericProbe<M>>
>;

type ExampleModel = MarkingMenuModel<{
  readonly items: readonly [{ readonly id: 'right'; readonly label: 'Right' }];
}>;
type OtherModel = MarkingMenuModel<{
  readonly items: readonly [{ readonly id: 'up'; readonly label: 'Up' }];
}>;

describe('a genuinely generic totorobot machine (the type-plumbing spike)', () => {
  it('resolves to a real, non-`never` type for a concrete model', () => {
    expectTypeOf<
      ProbeStates<ExampleModel>['open']['menu']
    >().not.toEqualTypeOf<never>();
    expectTypeOf<
      ProbeOutputs<ExampleModel>['selected']['leaf']
    >().toHaveProperty('id');
  });

  it('tracks whichever model a caller passes in, not one baked-in model', () => {
    expectTypeOf<
      ProbeOutputs<ExampleModel>['selected']['leaf']['id']
    >().toEqualTypeOf<'right'>();
    expectTypeOf<
      ProbeOutputs<OtherModel>['selected']['leaf']['id']
    >().toEqualTypeOf<'up'>();
  });
});
