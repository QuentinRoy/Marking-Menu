import { describe, expectTypeOf, it } from 'vitest';
import {
  createMarkingMenu,
  type MarkingMenuLogger,
} from './create-marking-menu.js';
import type { MarkingMenuItemInput } from './types.js';

/*
 Type level tests: they assert what the type system knows about
 `createMarkingMenu`'s public surface. They are checked by `tsc`, not run.
 */

declare const parent: HTMLElement;

describe('createMarkingMenu', () => {
  it('rejects sibling items sharing the same id', () => {
    // @ts-expect-error -- two items share the id `duplicate`.
    createMarkingMenu({
      items: [
        { id: 'duplicate', label: 'First' },
        { id: 'duplicate', label: 'Second' },
      ],
      parent,
    });
  });

  it('exposes select events typed on the exact literal item ids', () => {
    const mm = createMarkingMenu({
      items: [
        { id: 'right', label: 'Right' },
        { id: 'up', label: 'Up' },
      ],
      parent,
    });
    mm.on('select', (event) => {
      expectTypeOf(event.selection.id).toEqualTypeOf<'right' | 'up'>();
      expectTypeOf(event.selection.label).toEqualTypeOf<'Right' | 'Up'>();
      expectTypeOf(event.selection.isLeaf).toEqualTypeOf<true>();
      expectTypeOf(event.selection.parent.isRoot).toEqualTypeOf<true>();
      expectTypeOf(
        event.selection.parent.getChild('right').label,
      ).toEqualTypeOf<'Right'>();
    });
  });

  it('widens item types for a list built at runtime', () => {
    const items: MarkingMenuItemInput[] = [{ label: 'Right' }];
    const mm = createMarkingMenu({ items, parent });
    mm.on('select', (event) => {
      expectTypeOf(event.selection.label).toEqualTypeOf<string>();
    });
  });

  it('accepts a logger overriding only `error`', () => {
    createMarkingMenu({
      items: [{ id: 'right', label: 'Right' }],
      parent,
      log: { error: (error: unknown) => sendToSentry(error) },
    });
  });

  it('accepts `console` as the logger', () => {
    createMarkingMenu({
      items: [{ id: 'right', label: 'Right' }],
      parent,
      log: console,
    });
  });

  it('accepts a logger omitting `error`', () => {
    // Useless at runtime (nothing overrides the default), but harmless.
    createMarkingMenu({
      items: [{ id: 'right', label: 'Right' }],
      parent,
      log: {},
    });
  });

  it('accepts a logger whose `error` expects an `Error`', () => {
    // The point of typing `error` as `Error` rather than `unknown`: a
    // handler that only accepts `Error` (`reportError`, here) can be passed
    // directly, without a wrapper that widens its parameter first.
    createMarkingMenu({
      items: [{ id: 'right', label: 'Right' }],
      parent,
      log: { error: reportError },
    });
  });
});

declare function sendToSentry(error: unknown): void;
declare function reportError(error: Error): void;

describe('MarkingMenuLogger', () => {
  it('narrows `error` to a single `Error` argument, not varargs', () => {
    expectTypeOf<MarkingMenuLogger['error']>().toEqualTypeOf<
      ((error: Error) => void) | undefined
    >();
  });
});
