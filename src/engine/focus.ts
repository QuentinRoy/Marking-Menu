import type {
  MarkingMenuChangeEvent,
  MarkingMenuEventEmitter,
} from '../events.js';
import type { AnyModelNode } from '../types.js';

export type FocusManager = {
  dispose: () => void;
};

// Below the default `submenuOpeningDelay` (1000 / 3 ms), so the active item
// is announced before a submenu it points at can open.
const ACTIVE_ITEM_FOCUS_DELAY_MS = 50;

const menuContainer = (root: ShadowRoot): HTMLElement | null =>
  root.querySelector<HTMLElement>('[role="menu"]');

const itemElement = (root: ShadowRoot, key: string): HTMLElement | null =>
  [...root.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (element) => element.dataset.itemId === key,
  ) ?? null;

/**
 The element actually holding focus, unlike `document.activeElement`: a
 shadow host reports itself as active for any descendant focused inside it
 (DOM's own retargeting), which would otherwise save that host, rather than
 the caller's real focus, as `savedFocus`.
 */
const deepActiveElement = (doc: Document): Element | null => {
  let active = doc.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }

  return active;
};

/**
 Speaks the active item's label by moving real focus: the one mechanism
 announced on every target screen reader (no live region, no
 `aria-activedescendant`). Kept out of `machine.ts`: it reacts to the same
 public events a consumer would, and owns nothing the state machine needs.
 */
export function manageFocus<M extends AnyModelNode>({
  root,
  runtime,
}: {
  root: ShadowRoot;
  runtime: MarkingMenuEventEmitter<M>;
}): FocusManager {
  let pendingFocus: ReturnType<typeof setTimeout> | undefined;
  let savedFocus: HTMLElement | null = null;

  const clearPendingFocus = (): void => {
    clearTimeout(pendingFocus);
    pendingFocus = undefined;
  };

  const restoreFocus = (): void => {
    clearPendingFocus();
    savedFocus?.focus({ preventScroll: true });
    savedFocus = null;
  };

  const onOpen = (): void => {
    clearPendingFocus();
    savedFocus ??= deepActiveElement(root.ownerDocument) as HTMLElement | null;
    menuContainer(root)?.focus({ preventScroll: true });
  };

  const onChange = (event: MarkingMenuChangeEvent<M>): void => {
    clearPendingFocus();
    const { active } = event;
    if (active === null) {
      return;
    }

    // `active` is generically erased to `AnyModelNode` here, the same reason
    // `renderer.ts`'s own model cast exists: the compiler cannot prove
    // genericness away. Every real menu item built by `model.ts` carries a
    // `key`.
    const { key } = active as unknown as { key: string };
    pendingFocus = setTimeout(() => {
      itemElement(root, key)?.focus({ preventScroll: true });
    }, ACTIVE_ITEM_FOCUS_DELAY_MS);
  };

  runtime.on('open', onOpen);
  runtime.on('change', onChange);
  runtime.on('select', restoreFocus);
  runtime.on('cancel', restoreFocus);

  return {
    dispose() {
      // Disposing mid-gesture: nothing else will ever give the focus this
      // manager moved back to its owner, so this is the last chance to.
      restoreFocus();
      runtime.off('open', onOpen);
      runtime.off('change', onChange);
      runtime.off('select', restoreFocus);
      runtime.off('cancel', restoreFocus);
    },
  };
}
