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
import type { ModelLeaves, ModelMenus, ModelNode } from '../types.js';
import type { Point } from '../utils.js';
import { type navigationMachine, type NavigationOptions } from './machine.js';
import type { EngineModelMenu, EngineModelRoot } from './model-node.js';

/*
 Type-level tests: `StatesOf<>`/`OutputsOf<>` resolving over a generic model
 was the type plumbing #219 called out as the thing most likely to fight
 back. A totorobot definition is a single, non-generic value, so
 `navigationMachine` uses a recursive erased engine model instead of
 instantiating fields at a real `Model`; the probe at the bottom of this file
 proves those helpers preserve a caller's `Model` when one is available.
 Checked by `tsc`, not run.
 */

type States = StatesOf<typeof navigationMachine>;
type Outputs = OutputsOf<typeof navigationMachine>;

describe('StatesOf<typeof navigationMachine>', () => {
  it('names exactly the phases, and the recognition pseudostate', () => {
    expectTypeOf<keyof States>().toEqualTypeOf<
      'idle' | 'startup' | 'expert' | 'recognizing' | 'novice' | 'standalone'
    >();
  });

  it('threads model and options through every phase', () => {
    // `toEqualTypeOf` on the whole `States['idle']` object mistypes as a
    // mismatch here: `expect-type` gets confused comparing an intersection
    // against the engine model's `getNearestChild`, once that
    // intersection arrives through `MachineStates`' mapped type rather than
    // as a literal object type. Checking the keys and each field separately
    // sidesteps it without losing what the assertion is for.
    expectTypeOf<keyof States['idle']>().toEqualTypeOf<'model' | 'options'>();
    expectTypeOf<States['idle']['model']>().toEqualTypeOf<EngineModelRoot>();
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
    expectTypeOf<States['novice']['menu']>().toEqualTypeOf<EngineModelMenu>();
  });

  it('holds the stack of displayed menus, and a fixed center, only in standalone', () => {
    expectTypeOf<States['standalone']['menus']>().toEqualTypeOf<
      readonly EngineModelMenu[]
    >();
    expectTypeOf<States['standalone']['menuCenter']>().toEqualTypeOf<Point>();
    expectTypeOf<States['standalone']>().not.toHaveProperty('stroke');
    expectTypeOf<States['novice']>().not.toHaveProperty('menus');
  });

  it("is generic-safe: a caller's own model still threads through `model`", () => {
    const carryModel = <Model extends EngineModelRoot>(
      model: Model,
    ): States['idle'] => ({
      model,
      options: {
        movementsThreshold: 5,
        noviceDwellingTime: 1,
        deadZoneRadius: 40,
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
      MarkingMenuMoveEvent<ModelNode>
    >();
    expectTypeOf<Outputs['open']>().toEqualTypeOf<
      MarkingMenuOpenEvent<ModelNode>
    >();
    expectTypeOf<Outputs['change']>().toEqualTypeOf<
      MarkingMenuChangeEvent<ModelNode>
    >();
    expectTypeOf<Outputs['select']>().toEqualTypeOf<
      MarkingMenuSelectEvent<ModelNode>
    >();
    expectTypeOf<Outputs['cancel']>().toEqualTypeOf<
      MarkingMenuCancelEvent<ModelNode>
    >();
  });
});

// The type-plumbing spike: a machine kept genuinely generic over `Model`, built
// only to prove `StatesOf<>`/`OutputsOf<>` preserve it rather than resolving
// it early. That's the reason `navigationMachine` above erases every
// model-shaped field to its erased engine counterpart instead of keeping a real `Model`: this
// probe never gets erased, and never gets started either, since this file is
// type-checked only and never run.
function genericProbe<Model extends ModelNode>() {
  return machine({
    states: type<{
      idle: undefined;
      open: { readonly menu: ModelMenus<Model> };
    }>(),
    outputs: type<{ selected: { readonly leaf: ModelLeaves<Model> } }>(),
    initial: 'idle',
    transitions: {},
  });
}

type ProbeStates<Model extends ModelNode> = StatesOf<
  ReturnType<typeof genericProbe<Model>>
>;
type ProbeOutputs<Model extends ModelNode> = OutputsOf<
  ReturnType<typeof genericProbe<Model>>
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
