// `marking-menu` resolves through this package's own tsconfig path mapping
// rather than node_modules, which puts eslint-plugin-import-x's resolver and
// the prettier import-sort plugin at odds over where it belongs; the
// disable keeps prettier's ordering rather than fighting both tools.
import {
  MarkingMenuCancelEvent,
  MarkingMenuChangeEvent,
  MarkingMenuMoveEvent,
  MarkingMenuOpenEvent,
  MarkingMenuSelectEvent,
  MarkingMenuStartEvent,
  type AnyModelNode,
  type MarkingMenuEventMap,
  type MarkingMenuEventTarget,
  type MarkingMenuNotification,
  type ModelItems,
  type ModelMenus,
  type ReadonlyPoint,
} from 'marking-menu';
// eslint-disable-next-line import-x/order -- see the comment above: `marking-menu` resolves via this package's own path mapping, putting import-x's resolver and prettier's import sort at odds over where it belongs.
import type { Observable, Subscription } from 'rxjs';

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

 Wraps a private `EventTarget` rather than extending one: a real
 `class X extends EventTarget` overriding `addEventListener` fails
 TypeScript's override-compatibility check against the base class member
 (see `MarkingMenuEventTarget`'s own doc comment), so `addEventListener` and
 `removeEventListener` are declared here with their own narrow-overload-over
 -wide-implementation pair — the same idiom, applied to a method with no
 base class member to conflict with — and forward to the private target.
 */
class MarkingMenuEventShim<
  M extends AnyModelNode,
> implements MarkingMenuEventTarget<M> {
  readonly #target = new EventTarget();
  readonly #subscription: Subscription;
  #lastPosition: ReadonlyPoint = [0, 0];
  #lastMenu: ModelMenus<M> | null = null;
  #lastActive: ModelItems<M> | null = null;

  constructor(notifications$: Observable<MarkingMenuNotification<M>>) {
    // The one `subscribe` call left in the whole E2E suite: everything else
    // consumes this shim through `addEventListener`.
    this.#subscription = notifications$.subscribe({
      error(error: unknown) {
        console.error(error);
      },
      next: (notification) => {
        this.#target.dispatchEvent(this.#toEvent(notification));
      },
    });
  }

  #toEvent(notification: MarkingMenuNotification<M>): Event {
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

  addEventListener<K extends keyof MarkingMenuEventMap<M>>(
    type: K,
    listener: (
      this: MarkingMenuEventTarget<M>,
      event: MarkingMenuEventMap<M>[K],
    ) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    this.#target.addEventListener(type, listener, options);
  }

  removeEventListener<K extends keyof MarkingMenuEventMap<M>>(
    type: K,
    listener: (
      this: MarkingMenuEventTarget<M>,
      event: MarkingMenuEventMap<M>[K],
    ) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    this.#target.removeEventListener(type, listener, options);
  }

  dispatchEvent(event: Event): boolean {
    return this.#target.dispatchEvent(event);
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
): MarkingMenuEventTarget<M> & { dispose(): void } {
  return new MarkingMenuEventShim(notifications$);
}
