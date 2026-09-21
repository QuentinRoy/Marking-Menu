import type {
  MarkingMenuChangeEvent,
  MarkingMenuEventEmitter,
  MarkingMenuOpenEvent,
} from '../events.js';
import type { Menu } from '../layout/menu.js';
import type { ModelNode } from '../types.js';

export type FocusManager = {
  /**
   Say whether the standalone menu about to open takes focus, or is only
   displayed. Call it before the menu opens.
   */
  willOpenStandalone: (options: { focus: boolean }) => void;
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
  getMenu: () =>
    Pick<Menu, 'focusMenu' | 'focusItem' | 'focusTabStop'> | undefined;
  runtime: MarkingMenuEventEmitter<Model>;
}): FocusManager {
  let pendingFocus: ReturnType<typeof setTimeout> | undefined;
  let savedFocus: HTMLElement | undefined;
  let isStandaloneOpen = false;
  let willStandaloneTakeFocus = true;

  const clearPendingFocus = (): void => {
    clearTimeout(pendingFocus);
    pendingFocus = undefined;
  };

  const restoreFocus = (): void => {
    clearPendingFocus();
    isStandaloneOpen = false;
    savedFocus?.focus({ preventScroll: true });
    savedFocus = undefined;
  };

  const onOpen = (event: MarkingMenuOpenEvent<Model>): void => {
    clearPendingFocus();
    if (event.mode !== 'standalone') {
      savedFocus ??= deepActiveElement(doc) as HTMLElement | undefined;
      getMenu()?.focusMenu();
      return;
    }

    // A level entered or left with the keyboard: the `change` that follows
    // puts focus on the item it lands on.
    if (isStandaloneOpen) {
      return;
    }

    isStandaloneOpen = true;
    if (!willStandaloneTakeFocus) {
      return;
    }

    savedFocus ??= deepActiveElement(doc) as HTMLElement | undefined;
    // Nothing is active yet, so this is the first item. The platform reports
    // that focus back as a `focus` input, which is what makes it active.
    getMenu()?.focusTabStop();
  };

  const onChange = (event: MarkingMenuChangeEvent<Model>): void => {
    clearPendingFocus();
    const { active } = event;
    if (active === undefined) {
      return;
    }

    // Keyboard navigation moves at the pace of the keys. A gesture waits, so
    // an item the pointer only passes over is not announced.
    if (event.mode === 'standalone') {
      getMenu()?.focusItem(active.key);
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
    willOpenStandalone({ focus }) {
      willStandaloneTakeFocus = focus;
    },
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
