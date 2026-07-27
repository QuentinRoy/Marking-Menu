import type { Observable } from 'rxjs';
import { describe, expectTypeOf, it } from 'vitest';
import { createMarkingMenu } from './marking-menu.js';

/*
 Type level tests: they assert what the type system knows about
 `createMarkingMenu`'s public surface. They are checked by `tsc`, not run.
 */

/** The element type of an `Observable`. */
type Value<O> = O extends Observable<infer T> ? T : never;

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

  it('returns an observable on the leaf selections by default', () => {
    const menu$ = createMarkingMenu({
      items: [{ id: 'right', label: 'Right' }],
      parent,
    });
    expectTypeOf<Value<typeof menu$>['id']>().toEqualTypeOf<'right'>();
    expectTypeOf<Value<typeof menu$>['isLeaf']>().toEqualTypeOf<true>();
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
  });

  it('distributes over a widened notifySteps instead of collapsing to one branch', () => {
    // eslint-disable-next-line unicorn/consistent-boolean-name -- mirrors the public `notifySteps` config field.
    declare const notifySteps: boolean;
    const menu$ = createMarkingMenu({
      items: [{ id: 'right', label: 'Right' }],
      parent,
      notifySteps,
    });
    // Both branches survive: a notification's `type`, and a leaf's `id`.
    expectTypeOf<Value<typeof menu$>>().toHaveProperty('id');
    expectTypeOf<Value<typeof menu$>>().toHaveProperty('type');
  });
});
