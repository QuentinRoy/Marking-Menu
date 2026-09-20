import type {
  MarkingMenuChangeEvent,
  MarkingMenuEventEmitter,
} from '../events.js';
import type { Menu } from '../layout/menu.js';
import type { ModelNode } from '../types.js';

export type FocusManager = {
  dispose: () => void;
};

// Below the default `submenuOpeningDelay` (1000 / 3 ms), so the active item
// is announced before a submenu it points at can open.
const ACTIVE_ITEM_FOCUS_DELAY_MS = 50;

/**
 The element actually holding focus, unlike `document.activeElement`: a
 shadow host reports itself as active for any descendant focused inside it
 (DOM's own retargeting), which would otherwise save that host, rather than
 the caller's real focus, as `savedFocus`.
 */
const deepActiveElement = (doc: Document): Element | undefined => {
  let active = doc.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }

  return active ?? undefined;
};

/**
 Speaks the active item's label by moving real focus: the one mechanism
 announced on every target screen reader (no live region, no
 `aria-activedescendant`). Kept out of `machine.ts`: it reacts to the same
 public events a consumer would, and owns nothing the state machine needs.
 */
export function manageFocus<Model extends ModelNode = ModelNode>({
  doc,
  getMenu,
  runtime,
}: {
  doc: Document;
  getMenu: () => Pick<Menu, 'focusMenu' | 'focusItem'> | undefined;
  runtime: MarkingMenuEventEmitter<Model>;
}): FocusManager {
  let pendingFocus: ReturnType<typeof setTimeout> | undefined;
  let savedFocus: HTMLElement | undefined;

  const clearPendingFocus = (): void => {
    clearTimeout(pendingFocus);
    pendingFocus = undefined;
  };

  const restoreFocus = (): void => {
    clearPendingFocus();
    savedFocus?.focus({ preventScroll: true });
    savedFocus = undefined;
  };

  const onOpen = (): void => {
    clearPendingFocus();
    savedFocus ??= deepActiveElement(doc) as
      HTMLElement | undefined;
    getMenu()?.focusMenu();
  };

  const onChange = (event: MarkingMenuChangeEvent<Model>): void => {
    clearPendingFocus();
    const { active } = event;
    if (active === undefined) {
      return;
    }

    pendingFocus = setTimeout(() => {
      getMenu()?.focusItem(active.key);
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
