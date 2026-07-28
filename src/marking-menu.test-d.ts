import type { Observable } from 'rxjs';
import { describe, expectTypeOf, it } from 'vitest';
import { createMarkingMenu, type MarkingMenuLogger } from './marking-menu.js';
import type { MarkingMenuItemInput } from './types.js';

/*
 Type level tests: they assert what the type system knows about
 `createMarkingMenu`'s public surface. They are checked by `tsc`, not run.
 */

/** The element type of an `Observable`. */
type Value<O> = O extends Observable<infer T> ? T : never;

declare const parent: HTMLElement;
// eslint-disable-next-line unicorn/consistent-boolean-name -- mirrors the public `notifySteps` config field.
declare const notifySteps: boolean;

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

  it('returns an observable on the leaf selections by default', () => {
    const menu$ = createMarkingMenu({
      items: [{ id: 'right', label: 'Right' }],
      parent,
    });
    expectTypeOf<Value<typeof menu$>['id']>().toEqualTypeOf<'right'>();
    expectTypeOf<Value<typeof menu$>['isLeaf']>().toEqualTypeOf<true>();
  });

  it('returns typed selections for an item list built at runtime', () => {
    const items: MarkingMenuItemInput[] = [{ label: 'Right' }];
    const menu$ = createMarkingMenu({ items, parent });

    expectTypeOf<Value<typeof menu$>>().not.toBeNever();
    expectTypeOf<Value<typeof menu$>['label']>().toEqualTypeOf<string>();
  });

  it('returns an observable of notifications when notifySteps is true', () => {
    const menu$ = createMarkingMenu({
      items: [{ id: 'right', label: 'Right' }],
      parent,
      notifySteps: true,
    });
    expectTypeOf<Value<typeof menu$>['type']>().toEqualTypeOf<
      'start' | 'draw' | 'open' | 'move' | 'change' | 'select' | 'cancel'
    >();
    expectTypeOf<
      Extract<Value<typeof menu$>, { type: 'select' }>['mode']
    >().toEqualTypeOf<'startup' | 'novice' | 'expert'>();
    expectTypeOf<
      Extract<Value<typeof menu$>, { type: 'cancel' }>['mode']
    >().toEqualTypeOf<'startup' | 'novice' | 'expert'>();
  });

  it('distributes over a widened notifySteps instead of collapsing to one branch', () => {
    const menu$ = createMarkingMenu({
      items: [{ id: 'right', label: 'Right' }],
      parent,
      notifySteps,
    });
    // Both branches survive: a leaf (has `id`) and a notification (has `type`).
    // `keyof` the whole union would only give keys common to every member
    // (none, here), hence `Extract` instead of `toHaveProperty`.
    expectTypeOf<
      Extract<Value<typeof menu$>, { id: string }>
    >().not.toBeNever();
    expectTypeOf<
      Extract<Value<typeof menu$>, { type: string }>
    >().not.toBeNever();
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

  it('accepts a logger implementing extra methods like `info`/`warn`/`debug`', () => {
    // Nothing in the library calls them, but a richer logger (e.g. one
    // shared with the rest of an app) can still be passed as-is.
    createMarkingMenu({
      items: [{ id: 'right', label: 'Right' }],
      parent,
      log: {
        error: (error: unknown) => sendToSentry(error),
        info: (message: unknown) => sendToSentry(message),
        warn: (message: unknown) => sendToSentry(message),
        debug: (message: unknown) => sendToSentry(message),
      },
    });
  });

  it('accepts a logger omitting `error`', () => {
    // Useless at runtime (nothing overrides the default), but harmless — and
    // it leaves room for future logger methods without forcing every partial
    // override to include `error`.
    createMarkingMenu({
      items: [{ id: 'right', label: 'Right' }],
      parent,
      log: {},
    });
  });

  it('accepts a logger with only extra methods and no `error`', () => {
    createMarkingMenu({
      items: [{ id: 'right', label: 'Right' }],
      parent,
      log: { info: (message: unknown) => sendToSentry(message) },
    });
  });
});

declare function sendToSentry(error: unknown): void;

describe('MarkingMenuLogger', () => {
  it('narrows `error` to a single `unknown` argument, not varargs', () => {
    expectTypeOf<MarkingMenuLogger['error']>().toEqualTypeOf<
      (error: unknown) => void
    >();
  });

  it('allows properties beyond `error`', () => {
    const logger: MarkingMenuLogger = {
      error: (error: unknown) => sendToSentry(error),
      info: (message: unknown) => sendToSentry(message),
    };
    expectTypeOf(logger.info).not.toBeNever();
  });
});
