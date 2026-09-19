import { describe, expectTypeOf, it } from 'vitest';
import {
  type MarkingMenuCancelEvent,
  type MarkingMenuChangeEvent,
  type MarkingMenuEvent,
  type MarkingMenuEventEmitter,
  type MarkingMenuEventMap,
  type MarkingMenuMoveEvent,
  type MarkingMenuOpenEvent,
  type MarkingMenuSelectEvent,
  type MarkingMenuStartEvent,
} from './events.js';
import { createModel } from './model.js';
import type { MarkingMenuItemInput } from './types.js';
import { noOp } from './utils.js';

/*
 Type level tests: they assert what the type system knows about the event map
 and the discriminated union it derives. Checked by `tsc`, not run.
 */

const menu = createModel({
  items: [{ id: 'right', label: 'Right' }],
});
type M = typeof menu;

declare const dynamicItems: MarkingMenuItemInput[];
const dynamicMenu = createModel({ items: dynamicItems });
type DynamicM = typeof dynamicMenu;

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

  it('is not assignable to a DOM Event: this library is DOM-free', () => {
    expectTypeOf<MarkingMenuEvent<M>>().not.toExtend<Event>();
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

declare const target: MarkingMenuEventEmitter<M>;
declare const genericSelect: MarkingMenuSelectEvent;
declare const genericOpen: MarkingMenuOpenEvent;
declare const genericMove: MarkingMenuMoveEvent;
declare const dynamicSelect: MarkingMenuSelectEvent<DynamicM>;
declare const dynamicOpen: MarkingMenuOpenEvent<DynamicM>;
declare const dynamicChange: MarkingMenuChangeEvent<DynamicM>;

describe('Default generic and event payload narrowing', () => {
  it('exposes label and id on generic select event', () => {
    expectTypeOf(genericSelect.selection.label).toEqualTypeOf<string>();
    expectTypeOf(genericSelect.selection.id).toEqualTypeOf<string | undefined>();
    expectTypeOf(genericSelect.selection.isLeaf).toEqualTypeOf<true>();
    expectTypeOf(genericSelect.selection.isRoot).toEqualTypeOf<false>();
  });

  it('narrows menu on generic open event with isRoot', () => {
    if (genericOpen.menu.isRoot) {
      expectTypeOf(genericOpen.menu.parent).toEqualTypeOf<undefined>();
    } else {
      expectTypeOf(genericOpen.menu.label).toEqualTypeOf<string>();
      expectTypeOf(genericOpen.menu.key).toEqualTypeOf<string>();
    }
  });

  it('exposes item fields on generic move event active', () => {
    if (!genericMove.active) {
      return;
    }

    expectTypeOf(genericMove.active.key).toEqualTypeOf<string>();
    expectTypeOf(genericMove.active.label).toEqualTypeOf<string>();
    expectTypeOf(genericMove.active.isRoot).toEqualTypeOf<false>();
    if (genericMove.active.isLeaf) {
      expectTypeOf(genericMove.active.isLeaf).toEqualTypeOf<true>();
    }
  });

  it('statically types dynamic menu select payloads with isLeaf true', () => {
    expectTypeOf(dynamicSelect.selection.label).toEqualTypeOf<string>();
    expectTypeOf(dynamicSelect.selection.id).toEqualTypeOf<string | undefined>();
    expectTypeOf(dynamicSelect.selection.isLeaf).toEqualTypeOf<true>();
    expectTypeOf(dynamicSelect.selection.isRoot).toEqualTypeOf<false>();
  });

  it('narrows dynamic menu open payload with isRoot', () => {
    if (dynamicOpen.menu.isRoot) {
      expectTypeOf(dynamicOpen.menu.parent).toEqualTypeOf<undefined>();
    } else {
      expectTypeOf(dynamicOpen.menu.label).toEqualTypeOf<string>();
      expectTypeOf(dynamicOpen.menu.key).toEqualTypeOf<string>();
    }
  });

  it('narrows dynamic menu change active item', () => {
    if (!dynamicChange.active) {
      return;
    }

    expectTypeOf(dynamicChange.active.key).toEqualTypeOf<string>();
    expectTypeOf(dynamicChange.active.label).toEqualTypeOf<string>();
    if (dynamicChange.active.isLeaf) {
      expectTypeOf(dynamicChange.active.isLeaf).toEqualTypeOf<true>();
    }
  });
});

describe('MarkingMenuEventEmitter', () => {
  it('types the listener parameter of `on` per event name', () => {
    target.on('select', (event) => {
      expectTypeOf(event).toEqualTypeOf<MarkingMenuSelectEvent<M>>();
    });
    target.on('open', (event) => {
      expectTypeOf(event).toEqualTypeOf<MarkingMenuOpenEvent<M>>();
    });
  });

  it('types the listener parameter of `off` per event name', () => {
    target.off('select', noOp);
  });

  it('rejects unknown event names on `on` and `off`', () => {
    // @ts-expect-error -- `selectt` is not one of the six known event names.
    target.on('selectt', noOp);
    // @ts-expect-error -- there is no `type: string` fallback overload.
    target.on('anything', noOp);
    // @ts-expect-error -- same rejection applies to `off`.
    target.off('selectt', noOp);
  });
});
