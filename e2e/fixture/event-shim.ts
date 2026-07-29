// `marking-menu` resolves through this package's own tsconfig path mapping
// rather than node_modules, which puts eslint-plugin-import-x's resolver and
// the prettier import-sort plugin at odds over where it belongs; the
// disable keeps prettier's ordering rather than fighting both tools.
import type { Observable, Subscription } from 'rxjs';
import {
  MarkingMenuCancelEvent,
  MarkingMenuChangeEvent,
  MarkingMenuMoveEvent,
  MarkingMenuOpenEvent,
  MarkingMenuSelectEvent,
  MarkingMenuStartEvent,
  type AnyModelNode,
  type MarkingMenuEvent,
  type MarkingMenuEventEmitter,
  type MarkingMenuEventMap,
  type MarkingMenuNotification,
  type ModelItems,
  type ModelMenus,
  type ReadonlyPoint,
} from 'marking-menu';

/**
 Test-only shim translating the legacy `notifySteps` Observable into the
 final typed event contract (#153), so the E2E fixture and specs can target
 the shape the library will eventually dispatch while the RxJS engine
 underneath is unchanged. Deleted at cutover; nothing here is ever shipped.

 The legacy stream has no `menu` on `move`/`change`, no `position` on `open`
 (and, when a gesture ends without ever moving, on `select`/`cancel`
 either), and names the abandoned-gesture item `selection` instead of
 `active`. This carries the last-seen menu, active item, and drag position
 forward across notifications to fill in what the legacy engine has no field
 for, and renames on the way out.

 Hand-rolls its listener bookkeeping because the shim only sees the public
 `marking-menu` package, which does not re-export the `mitt` the engine uses.
 */
class MarkingMenuEventShim<
  M extends AnyModelNode,
> implements MarkingMenuEventEmitter<M> {
  readonly #listeners = new Map<
    string,
    Set<(event: MarkingMenuEvent<M>) => void>
  >();

  readonly #subscription: Subscription;
  #lastPosition: ReadonlyPoint = [0, 0];
  #lastMenu: ModelMenus<M> | null = null;
  #lastActive: ModelItems<M> | null = null;

  constructor(notifications$: Observable<MarkingMenuNotification<M>>) {
    // The one `subscribe` call left in the whole E2E suite: everything else
    // consumes this shim through `on`.
    this.#subscription = notifications$.subscribe({
      error(error: unknown) {
        console.error(error);
      },
      next: (notification) => {
        const event = this.#toEvent(notification);
        for (const listener of this.#listeners.get(event.type) ?? []) {
          listener(event);
        }
      },
    });
  }

  #toEvent(notification: MarkingMenuNotification<M>): MarkingMenuEvent<M> {
    const position = notification.position ?? this.#lastPosition;
    this.#lastPosition = position;

    switch (notification.type) {
      case 'start': {
        return new MarkingMenuStartEvent({ position });
      }

      case 'draw': {
        // `draw` (startup|expert) merges into `move`: identical payload,
        // and no menu can be active since none is open yet.
        return new MarkingMenuMoveEvent<M>({
          active: null,
          menu: null,
          mode: notification.mode,
          position,
        });
      }

      case 'open': {
        this.#lastMenu = notification.menu;
        // Nothing is active right at open (see `MarkingMenuOpenEvent`'s doc
        // comment); without this, a submenu's first `change` would report
        // the parent menu's last active item as `previousActive` instead of
        // `null`.
        this.#lastActive = null;
        return new MarkingMenuOpenEvent<M>({
          menu: notification.menu,
          menuCenter: notification.menuCenter,
          position,
        });
      }

      case 'move': {
        return new MarkingMenuMoveEvent<M>({
          active: notification.active,
          menu: this.#lastMenu,
          mode: notification.mode,
          position,
        });
      }

      case 'change': {
        const event = new MarkingMenuChangeEvent<M>({
          active: notification.active,
          // `#lastMenu` is always set here: `change` only fires in novice
          // mode, once `open` has run.
          menu: this.#lastMenu as ModelMenus<M>,
          position,
          previousActive: this.#lastActive,
        });
        this.#lastActive = notification.active;
        return event;
      }

      case 'select': {
        const event = new MarkingMenuSelectEvent<M>({
          menu: this.#lastMenu,
          mode: notification.mode,
          position,
          selection: notification.selection,
        });
        this.#lastMenu = null;
        this.#lastActive = null;
        return event;
      }

      case 'cancel': {
        const event = new MarkingMenuCancelEvent<M>({
          active: notification.selection ?? null,
          menu: this.#lastMenu,
          mode: notification.mode,
          position,
        });
        this.#lastMenu = null;
        this.#lastActive = null;
        return event;
      }
    }
  }

  on<K extends keyof MarkingMenuEventMap<M>>(
    type: K,
    listener: (event: MarkingMenuEventMap<M>[K]) => void,
  ): void {
    const asUntyped = listener as (event: MarkingMenuEvent<M>) => void;
    const listeners = this.#listeners.get(type);
    if (listeners === undefined) {
      this.#listeners.set(type, new Set([asUntyped]));
    } else {
      listeners.add(asUntyped);
    }
  }

  off<K extends keyof MarkingMenuEventMap<M>>(
    type: K,
    listener: (event: MarkingMenuEventMap<M>[K]) => void,
  ): void {
    this.#listeners
      .get(type)
      ?.delete(listener as (event: MarkingMenuEvent<M>) => void);
  }

  dispose(): void {
    this.#subscription.unsubscribe();
  }
}

/**
 Adapt a legacy `notifySteps` Observable to the final typed event contract.
 See {@link MarkingMenuEventShim}.
 */
export function shimMarkingMenuEvents<M extends AnyModelNode>(
  notifications$: Observable<MarkingMenuNotification<M>>,
): MarkingMenuEventEmitter<M> & { dispose(): void } {
  return new MarkingMenuEventShim(notifications$);
}
