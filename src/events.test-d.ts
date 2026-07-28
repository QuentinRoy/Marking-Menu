import { describe, expectTypeOf, it } from 'vitest';
import type {
  MarkingMenuCancelEvent,
  MarkingMenuChangeEvent,
  MarkingMenuEvent,
  MarkingMenuEventMap,
  MarkingMenuEventTarget,
  MarkingMenuMoveEvent,
  MarkingMenuOpenEvent,
  MarkingMenuSelectEvent,
  MarkingMenuStartEvent,
} from './events.js';
import { createModel } from './model.js';
import { noOp } from './utils.js';

/*
 Type level tests: they assert what the type system knows about the event map
 and the discriminated union it derives. Checked by `tsc`, not run.
 */

const menu = createModel({
  items: [{ id: 'right', label: 'Right' }],
});
type M = typeof menu;

describe('MarkingMenuEventMap', () => {
  it('maps each event name to its exact event class', () => {
    expectTypeOf<MarkingMenuEventMap<M>>().toEqualTypeOf<{
      start: MarkingMenuStartEvent;
      open: MarkingMenuOpenEvent<M>;
      move: MarkingMenuMoveEvent<M>;
      change: MarkingMenuChangeEvent<M>;
      select: MarkingMenuSelectEvent<M>;
      cancel: MarkingMenuCancelEvent<M>;
    }>();
  });

  it('is closed: only the six event names are keys', () => {
    expectTypeOf<keyof MarkingMenuEventMap<M>>().toEqualTypeOf<
      'start' | 'open' | 'move' | 'change' | 'select' | 'cancel'
    >();
  });
});

describe('MarkingMenuEvent', () => {
  it('is the union of every event in the map', () => {
    expectTypeOf<MarkingMenuEvent<M>>().toEqualTypeOf<
      | MarkingMenuStartEvent
      | MarkingMenuOpenEvent<M>
      | MarkingMenuMoveEvent<M>
      | MarkingMenuChangeEvent<M>
      | MarkingMenuSelectEvent<M>
      | MarkingMenuCancelEvent<M>
    >();
  });

  it('discriminates exhaustively on `type` across a `switch`', () => {
    // No `default` case: `@typescript-eslint/switch-exhaustiveness-check`
    // already fails the build if a case is missing, and `noImplicitReturns`
    // fails it if a covered case doesn't return.
    function handle(event: MarkingMenuEvent<M>): string {
      switch (event.type) {
        case 'start': {
          expectTypeOf(event).toEqualTypeOf<MarkingMenuStartEvent>();
          return event.mode;
        }

        case 'open': {
          expectTypeOf(event).toEqualTypeOf<MarkingMenuOpenEvent<M>>();
          return String(event.menu.isLeaf);
        }

        case 'move': {
          expectTypeOf(event).toEqualTypeOf<MarkingMenuMoveEvent<M>>();
          return String(event.active?.label);
        }

        case 'change': {
          expectTypeOf(event).toEqualTypeOf<MarkingMenuChangeEvent<M>>();
          return String(event.previousActive?.label);
        }

        case 'select': {
          expectTypeOf(event).toEqualTypeOf<MarkingMenuSelectEvent<M>>();
          return event.selection.label;
        }

        case 'cancel': {
          expectTypeOf(event).toEqualTypeOf<MarkingMenuCancelEvent<M>>();
          return String(event.active?.label);
        }
      }
    }

    expectTypeOf(handle).returns.toBeString();
  });
});

declare const target: MarkingMenuEventTarget<M>;

describe('MarkingMenuEventTarget', () => {
  it('types the listener parameter of addEventListener per event name', () => {
    target.addEventListener('select', (event) => {
      expectTypeOf(event).toEqualTypeOf<MarkingMenuSelectEvent<M>>();
    });
    target.addEventListener('open', (event) => {
      expectTypeOf(event).toEqualTypeOf<MarkingMenuOpenEvent<M>>();
    });
  });

  it('types the listener parameter of removeEventListener per event name', () => {
    target.removeEventListener('select', noOp);
  });

  it('rejects unknown event names on addEventListener and removeEventListener', () => {
    // @ts-expect-error -- `selectt` is not one of the six known event names.
    target.addEventListener('selectt', noOp);
    // @ts-expect-error -- there is no `type: string` fallback overload.
    target.addEventListener('anything', noOp);
    // @ts-expect-error -- same rejection applies to removeEventListener.
    target.removeEventListener('selectt', noOp);
  });

  it('leaves `once`, `signal` and `capture` unaffected', () => {
    const controller = new AbortController();
    target.addEventListener('select', noOp, {
      once: true,
      capture: true,
      signal: controller.signal,
    });
    target.addEventListener('select', noOp, { capture: true });
  });

  it('remains assignable to EventTarget via the documented escape hatch', () => {
    // The typed facade narrows the listener parameter, so plain implicit
    // assignment to `EventTarget` is intentionally not what's being tested
    // here — the documented escape hatch is the explicit downcast, which
    // stays available for exactly the case an unknown event name is needed.
    const asEventTarget: EventTarget = target as EventTarget;
    asEventTarget.addEventListener('anything', noOp);
    expectTypeOf(asEventTarget).toEqualTypeOf<EventTarget>();
  });

  it('keeps dispatchEvent unmodified from EventTarget', () => {
    expectTypeOf(target.dispatchEvent).toEqualTypeOf<
      EventTarget['dispatchEvent']
    >();
  });
});
