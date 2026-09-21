import { describe, expectTypeOf, it } from 'vitest';
import {
  type MarkingMenuCancelEvent,
  type MarkingMenuChangeEvent,
  type MarkingMenuEvent,
  type MarkingMenuEventEmitter,
  type MarkingMenuEventMap,
  type MarkingMenuMode,
  type MarkingMenuMoveEvent,
  type MarkingMenuOpenEvent,
  type MarkingMenuRecognition,
  type MarkingMenuSelectEvent,
  type MarkingMenuStartEvent,
} from './events.js';
import { createModel } from './model.js';
import type { MarkingMenuItemInput } from './types.js';
import { noOp, type Point } from './utils.js';

/*
 Type level tests: they assert what the type system knows about the event map
 and the discriminated union it derives. Checked by `tsc`, not run.
 */

const menu = createModel({
  items: [{ id: 'right', label: 'Right' }],
});
type Model = typeof menu;

declare const dynamicItems: MarkingMenuItemInput[];
const dynamicMenu = createModel({ items: dynamicItems });
type DynamicM = typeof dynamicMenu;

type GestureMode = Exclude<MarkingMenuMode, 'standalone'>;
type OpenEvent =
  | MarkingMenuOpenEvent<Model, 'novice'>
  | MarkingMenuOpenEvent<Model, 'standalone'>;
type ChangeEvent =
  | MarkingMenuChangeEvent<Model, 'novice'>
  | MarkingMenuChangeEvent<Model, 'standalone'>;
type SelectEvent =
  | MarkingMenuSelectEvent<Model, GestureMode>
  | MarkingMenuSelectEvent<Model, 'standalone'>;
type CancelEvent =
  | MarkingMenuCancelEvent<Model, GestureMode>
  | MarkingMenuCancelEvent<Model, 'standalone'>;

describe('MarkingMenuEventMap', () => {
  it('maps each event name to its exact event class', () => {
    expectTypeOf<MarkingMenuEventMap<Model>>().toEqualTypeOf<{
      start: MarkingMenuStartEvent;
      open: OpenEvent;
      move: MarkingMenuMoveEvent<Model>;
      change: ChangeEvent;
      select: SelectEvent;
      cancel: CancelEvent;
    }>();
  });

  it('is closed: only the six event names are keys', () => {
    expectTypeOf<keyof MarkingMenuEventMap<Model>>().toEqualTypeOf<
      'start' | 'open' | 'move' | 'change' | 'select' | 'cancel'
    >();
  });
});

describe('MarkingMenuEvent', () => {
  it('is the union of every event in the map', () => {
    expectTypeOf<MarkingMenuEvent<Model>>().toEqualTypeOf<
      | MarkingMenuStartEvent
      | OpenEvent
      | MarkingMenuMoveEvent<Model>
      | ChangeEvent
      | SelectEvent
      | CancelEvent
    >();
  });

  it('is not assignable to a DOM Event: this library is DOM-free', () => {
    expectTypeOf<MarkingMenuEvent<Model>>().not.toExtend<Event>();
  });

  it('discriminates exhaustively on `type` across a `switch`', () => {
    // No `default` case: `@typescript-eslint/switch-exhaustiveness-check`
    // already fails the build if a case is missing, and `noImplicitReturns`
    // fails it if a covered case doesn't return.
    function handle(event: MarkingMenuEvent<Model>): string {
      switch (event.type) {
        case 'start': {
          expectTypeOf(event).toEqualTypeOf<MarkingMenuStartEvent>();
          return event.mode;
        }

        case 'open': {
          expectTypeOf(event).toEqualTypeOf<OpenEvent>();
          return String(event.menu.isLeaf);
        }

        case 'move': {
          expectTypeOf(event).toEqualTypeOf<MarkingMenuMoveEvent<Model>>();
          return String(event.active?.label);
        }

        case 'change': {
          expectTypeOf(event).toEqualTypeOf<ChangeEvent>();
          return String(event.previousActive?.label);
        }

        case 'select': {
          expectTypeOf(event).toEqualTypeOf<SelectEvent>();
          return event.selection.label;
        }

        case 'cancel': {
          expectTypeOf(event).toEqualTypeOf<CancelEvent>();
          return String(event.active?.label);
        }
      }
    }

    expectTypeOf(handle).returns.toBeString();
  });
});

declare const anySelect: SelectEvent;

describe('mode and position', () => {
  it('accepts every mode, standalone included', () => {
    expectTypeOf<MarkingMenuMode>().toEqualTypeOf<
      'startup' | 'novice' | 'expert' | 'standalone'
    >();
  });

  it('narrows `position` on `mode`: a point outside standalone, undefined in it', () => {
    function positionOf(event: SelectEvent): Point | undefined {
      if (event.mode === 'standalone') {
        expectTypeOf(event.position).toEqualTypeOf<undefined>();
        return event.position;
      }

      expectTypeOf(event.mode).toEqualTypeOf<GestureMode>();
      expectTypeOf(event.position).toEqualTypeOf<Point>();
      return event.position;
    }

    expectTypeOf(positionOf).returns.toEqualTypeOf<Point | undefined>();
  });

  it('narrows `reason` on `mode`: `dismissed` in standalone, the other two outside it', () => {
    function reasonOf(event: CancelEvent) {
      if (event.mode === 'standalone') {
        expectTypeOf(event.reason).toEqualTypeOf<'dismissed'>();
        return event.reason;
      }

      expectTypeOf(event.reason).toEqualTypeOf<
        'interrupted' | 'no-selection'
      >();
      return event.reason;
    }

    expectTypeOf(reasonOf).returns.toEqualTypeOf<
      'dismissed' | 'interrupted' | 'no-selection'
    >();
  });

  it('leaves `position` possibly undefined until `mode` is narrowed', () => {
    expectTypeOf(anySelect.position).toEqualTypeOf<Point | undefined>();
  });

  it('keeps `start` and `move` out of standalone mode', () => {
    expectTypeOf<MarkingMenuStartEvent['mode']>().toEqualTypeOf<'startup'>();
    expectTypeOf<
      MarkingMenuMoveEvent<Model>['mode']
    >().toEqualTypeOf<GestureMode>();
    expectTypeOf<
      MarkingMenuMoveEvent<Model>['position']
    >().toEqualTypeOf<Point>();
  });

  it('gives `start` a mode type parameter too, which can only be startup', () => {
    expectTypeOf<
      MarkingMenuStartEvent<'startup'>
    >().toEqualTypeOf<MarkingMenuStartEvent>();
    expectTypeOf<MarkingMenuStartEvent['position']>().toEqualTypeOf<Point>();
    // @ts-expect-error -- a gesture only ever starts in startup mode.
    expectTypeOf<MarkingMenuStartEvent<'novice'>>().not.toBeNever();
  });

  it('keeps `open` and `change` to the modes with a menu open', () => {
    expectTypeOf<OpenEvent['mode']>().toEqualTypeOf<'novice' | 'standalone'>();
    expectTypeOf<ChangeEvent['mode']>().toEqualTypeOf<
      'novice' | 'standalone'
    >();
  });
});

describe('recognition', () => {
  it('is optional on open, select and cancel', () => {
    expectTypeOf<OpenEvent['recognition']>().toEqualTypeOf<
      MarkingMenuRecognition | undefined
    >();
    expectTypeOf<SelectEvent['recognition']>().toEqualTypeOf<
      MarkingMenuRecognition | undefined
    >();
    expectTypeOf<CancelEvent['recognition']>().toEqualTypeOf<
      MarkingMenuRecognition | undefined
    >();
  });

  it('is absent from the events that never recognize', () => {
    expectTypeOf<MarkingMenuStartEvent>().not.toHaveProperty('recognition');
    expectTypeOf<MarkingMenuMoveEvent<Model>>().not.toHaveProperty(
      'recognition',
    );
    expectTypeOf<ChangeEvent>().not.toHaveProperty('recognition');
  });

  it('is a read-only snapshot of the stroke and how it was cut, with no model in it', () => {
    expectTypeOf<MarkingMenuRecognition>().toEqualTypeOf<{
      readonly stroke: readonly Point[];
      readonly analysis: {
        readonly articulationPoints: readonly Point[];
        readonly segments: ReadonlyArray<{
          readonly points: readonly [Point, Point];
        }>;
      };
    }>();
  });
});

declare const target: MarkingMenuEventEmitter<Model>;
declare const genericSelect: MarkingMenuSelectEvent;
declare const genericOpen: MarkingMenuOpenEvent;
declare const genericMove: MarkingMenuMoveEvent;
declare const dynamicSelect: MarkingMenuSelectEvent<DynamicM>;
declare const dynamicOpen: MarkingMenuOpenEvent<DynamicM>;
declare const dynamicChange: MarkingMenuChangeEvent<DynamicM>;

describe('Default generic and event payload narrowing', () => {
  it('exposes label and id on generic select event', () => {
    expectTypeOf(genericSelect.selection.label).toEqualTypeOf<string>();
    expectTypeOf(genericSelect.selection.id).toEqualTypeOf<
      string | undefined
    >();
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
    expectTypeOf(dynamicSelect.selection.id).toEqualTypeOf<
      string | undefined
    >();
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
      expectTypeOf(event).toEqualTypeOf<SelectEvent>();
    });
    target.on('open', (event) => {
      expectTypeOf(event).toEqualTypeOf<OpenEvent>();
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
