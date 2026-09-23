import { describe, expectTypeOf, it } from 'vitest';
import type { MarkingMenuEventMap, MarkingMenuStartEvent } from '../events.js';
import type { MarkingMenuModel } from '../model.js';
import type { ModelItems, ModelMenus } from '../types.js';
import { noOp, type Point } from '../utils.js';
import {
  createController,
  type MarkingMenuController,
  type MarkingMenuOpenOptions,
} from './controller.js';

/*
 Type level tests: the model the controller's events carry is the one the
 *literal* config describes, not a widened one. Checked by `tsc`, not run.

 `Model` appears only in input positions on the controller, so
 `MarkingMenuController<A>` and `MarkingMenuController<B>` stay mutually
 assignable and no plain assignment can catch the model widening. Reading a
 narrowed payload off a listener parameter is what catches it.
 */

const parent = undefined as unknown as HTMLElement;

const config = {
  items: [
    { id: 'right', label: 'Right' },
    { id: 'down', label: 'Down' },
    { id: 'left', label: 'Left' },
    { id: 'up', label: 'Up' },
  ],
  parent,
} as const;

const controller = createController(config);
type Model = MarkingMenuModel<typeof config>;

describe('createController', () => {
  it('returns the controller for the model the literal config describes', () => {
    expectTypeOf(controller).toEqualTypeOf<MarkingMenuController<Model>>();
  });

  it('exposes disposal as a plain method', () => {
    expectTypeOf(controller.dispose).toEqualTypeOf<() => void>();
  });

  it('exposes exactly the listen-only facade, open and close, state, and both forms of disposal, nothing else', () => {
    expectTypeOf<keyof MarkingMenuController<Model>>().toEqualTypeOf<
      | 'on'
      | 'off'
      | 'open'
      | 'close'
      | 'state'
      | 'dispose'
      | typeof Symbol.dispose
    >();
  });

  it('shows no phase or open flag: a consumer follows the events', () => {
    expectTypeOf<MarkingMenuController<Model>>().not.toHaveProperty('phase');
    expectTypeOf<MarkingMenuController<Model>>().not.toHaveProperty('isOpen');
  });
});

describe('createController open and close', () => {
  it('opens with no argument, or with optional options', () => {
    expectTypeOf(controller.open).toBeCallableWith();
    expectTypeOf(controller.open).toBeCallableWith({});
    expectTypeOf(controller.open).toBeCallableWith({
      position: [1, 2],
      focus: false,
    });
    expectTypeOf(controller.open).returns.toBeVoid();
  });

  it('takes a position in client coordinates and whether to take focus, nothing else', () => {
    expectTypeOf<MarkingMenuOpenOptions>().toEqualTypeOf<{
      readonly position?: Point;
      readonly focus?: boolean;
    }>();
  });

  it('rejects options it does not know', () => {
    // @ts-expect-error -- there is no such option.
    controller.open({ label: 'Menu' });
    // @ts-expect-error -- a position is a point, not a pair of options.
    controller.open({ position: { x: 1, y: 2 } });
  });

  it('closes with no argument', () => {
    expectTypeOf(controller.close).toEqualTypeOf<() => void>();
  });
});

describe('createController listeners', () => {
  it('narrows `select` to the literal leaf ids, not `string`', () => {
    controller.on('select', (event) => {
      expectTypeOf(event).toEqualTypeOf<MarkingMenuEventMap<Model>['select']>();
      // The assertion that actually fails if the model widens to
      // `MarkingMenuModel<EngineConfig>`: `id` collapses to `string` there.
      expectTypeOf(event.selection.id).toEqualTypeOf<
        'right' | 'down' | 'left' | 'up'
      >();
      expectTypeOf(event.selection.isLeaf).toEqualTypeOf<true>();
    });
  });

  it('narrows `change` to this model, including the open menu', () => {
    controller.on('change', (event) => {
      expectTypeOf(event).toEqualTypeOf<MarkingMenuEventMap<Model>['change']>();
      expectTypeOf(event.menu.isLeaf).toEqualTypeOf<false>();
      expectTypeOf(event.mode).toEqualTypeOf<'novice' | 'standalone'>();
    });
  });

  it('widens `position` on `mode`: a point or undefined in standalone, always a point outside it', () => {
    controller.on('cancel', (event) => {
      if (event.mode === 'standalone') {
        expectTypeOf(event.position).toEqualTypeOf<Point | undefined>();
      } else {
        expectTypeOf(event.position).toEqualTypeOf<Point>();
      }
    });
  });

  it('narrows `start`, which is model independent', () => {
    controller.on('start', (event) => {
      expectTypeOf(event).toEqualTypeOf<MarkingMenuStartEvent>();
      expectTypeOf(event.mode).toEqualTypeOf<'startup'>();
    });
  });

  it('narrows `state` on `mode`: only novice and standalone carry a menu, typed to this model', () => {
    const { state } = controller;
    expectTypeOf(state.mode).toEqualTypeOf<
      'idle' | 'startup' | 'expert' | 'novice' | 'standalone'
    >();
    if (state.mode === 'novice' || state.mode === 'standalone') {
      expectTypeOf(state.menu).toEqualTypeOf<ModelMenus<Model>>();
      expectTypeOf(state.activeItem).toEqualTypeOf<
        ModelItems<Model> | undefined
      >();
    } else {
      expectTypeOf(state).not.toHaveProperty('menu');
    }
  });

  it('rejects an unknown event name', () => {
    // @ts-expect-error -- the event map is closed; there is no `string` fallback.
    controller.on('nope', noOp);
  });

  it('rejects a listener widened to the wrong event', () => {
    controller.on(
      'select',
      // @ts-expect-error -- a `select` listener cannot take a `change` event.
      (event: MarkingMenuEventMap<Model>['change']) => {
        expectTypeOf(event).toEqualTypeOf<
          MarkingMenuEventMap<Model>['change']
        >();
      },
    );
  });

  it('removes listeners under the same narrowing', () => {
    const onSelect = (event: MarkingMenuEventMap<Model>['select']): void => {
      expectTypeOf(event.selection.id).toEqualTypeOf<
        'right' | 'down' | 'left' | 'up'
      >();
    };

    controller.on('select', onSelect);
    controller.off('select', onSelect);
  });
});
