import { describe, expectTypeOf, it } from 'vitest';
import type {
  MarkingMenuChangeEvent,
  MarkingMenuSelectEvent,
  MarkingMenuStartEvent,
} from '../events.js';
import type { MarkingMenuModel } from '../model.js';
import { noOp } from '../utils.js';
import { createController, type MarkingMenuController } from './controller.js';

/*
 Type level tests: the model the controller's events carry is the one the
 *literal* config describes, not a widened one. Checked by `tsc`, not run.

 `M` appears only in input positions on the controller, so
 `MarkingMenuController<A>` and `MarkingMenuController<B>` stay mutually
 assignable and no plain assignment can catch the model widening. Reading a
 narrowed payload off a listener parameter is what catches it.
 */

const parent = null as unknown as HTMLElement;

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
type M = MarkingMenuModel<typeof config>;

describe('createController', () => {
  it('returns the controller for the model the literal config describes', () => {
    expectTypeOf(controller).toEqualTypeOf<MarkingMenuController<M>>();
  });

  it('exposes both disposal forms', () => {
    expectTypeOf(controller.dispose).toEqualTypeOf<() => void>();
    expectTypeOf(controller[Symbol.dispose]).toEqualTypeOf<() => void>();
  });

  it('exposes exactly the listen-only facade and disposal, nothing else', () => {
    expectTypeOf<keyof MarkingMenuController<M>>().toEqualTypeOf<
      'on' | 'off' | 'dispose' | typeof Symbol.dispose
    >();
  });
});

describe('createController listeners', () => {
  it('narrows `select` to the literal leaf ids, not `string`', () => {
    controller.on('select', (event) => {
      expectTypeOf(event).toEqualTypeOf<MarkingMenuSelectEvent<M>>();
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
      expectTypeOf(event).toEqualTypeOf<MarkingMenuChangeEvent<M>>();
      expectTypeOf(event.menu.isLeaf).toEqualTypeOf<false>();
      expectTypeOf(event.mode).toEqualTypeOf<'novice'>();
    });
  });

  it('narrows `start`, which is model independent', () => {
    controller.on('start', (event) => {
      expectTypeOf(event).toEqualTypeOf<MarkingMenuStartEvent>();
      expectTypeOf(event.mode).toEqualTypeOf<'startup'>();
    });
  });

  it('rejects an unknown event name', () => {
    // @ts-expect-error -- the event map is closed; there is no `string` fallback.
    controller.on('nope', noOp);
  });

  it('rejects a listener widened to the wrong event', () => {
    controller.on(
      'select',
      // @ts-expect-error -- a `select` listener cannot take a `change` event.
      (event: MarkingMenuChangeEvent<M>) => {
        expectTypeOf(event).toEqualTypeOf<MarkingMenuChangeEvent<M>>();
      },
    );
  });

  it('removes listeners under the same narrowing', () => {
    const onSelect = (event: MarkingMenuSelectEvent<M>): void => {
      expectTypeOf(event.selection.id).toEqualTypeOf<
        'right' | 'down' | 'left' | 'up'
      >();
    };

    controller.on('select', onSelect);
    controller.off('select', onSelect);
  });
});
