import type {
  MarkingMenuCancelEvent,
  MarkingMenuChangeEvent,
  MarkingMenuEventEmitter,
  MarkingMenuOpenEvent,
} from '../events.js';
import type { Menu } from '../layout/menu.js';
import type { ModelNode } from '../types.js';

export type FocusManager = {
  dispose: () => void;
};

// Long enough that an item the pointer only passes over is not announced.
const MAX_ACTIVE_ITEM_FOCUS_DELAY_MS = 50;

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
  submenuOpeningDelay,
}: {
  doc: Document;
  getMenu: () =>
    Pick<Menu, 'focusMenu' | 'focusItem' | 'focusTabStop'> | undefined;
  runtime: MarkingMenuEventEmitter<Model>;
  submenuOpeningDelay: number;
}): FocusManager {
  // Below the submenu delay, so the item is announced before its submenu can
  // open and clear the announcement.
  const activeItemFocusDelay = Math.min(
    MAX_ACTIVE_ITEM_FOCUS_DELAY_MS,
    submenuOpeningDelay / 2,
  );
  let pendingFocus: ReturnType<typeof setTimeout> | undefined;
  let savedFocus: HTMLElement | undefined;
  let isStandaloneOpen = false;

  const clearPendingFocus = (): void => {
    clearTimeout(pendingFocus);
    pendingFocus = undefined;
  };

  const saveFocus = (): void => {
    savedFocus ??= deepActiveElement(doc) as HTMLElement | undefined;
  };

  const endInteraction = (): void => {
    clearPendingFocus();
    isStandaloneOpen = false;
    savedFocus = undefined;
  };

  const restoreFocus = (): void => {
    const target = savedFocus;
    endInteraction();
    target?.focus({ preventScroll: true });
  };

  const onOpen = (event: MarkingMenuOpenEvent<Model>): void => {
    clearPendingFocus();
    if (event.mode !== 'standalone') {
      saveFocus();
      getMenu()?.focusMenu();
      return;
    }

    if (isStandaloneOpen) {
      // A level entered or left with the keyboard needs nothing here: the
      // `change` that follows puts focus on the item it lands on. A pointer
      // release opening a submenu carries no such `change` (it starts with
      // nothing active), so it takes the container itself instead.
      if (event.source === 'pointer') {
        getMenu()?.focusMenu();
      }

      return;
    }

    isStandaloneOpen = true;
    // Captured whether or not this menu takes focus: a pointer release may
    // still move real focus later (into a submenu it opens), and restoring
    // on close needs somewhere to return to even then.
    saveFocus();
    if (!event.willAutoFocus) {
      return;
    }

    // Nothing is active yet, so this is the first item. The platform reports
    // that focus back as a `focus` input, which is what makes it active.
    getMenu()?.focusTabStop();
  };

  const onChange = (event: MarkingMenuChangeEvent<Model>): void => {
    clearPendingFocus();
    const { activeItem: active } = event;
    if (active === undefined) {
      return;
    }

    // Keyboard navigation moves at the pace of the keys. A gesture waits, so
    // an item the pointer only passes over is not announced. A menu that did
    // not take focus follows too: a `change` means the user is on it. A
    // pointer-caused change, hover or press, never moves real focus.
    if (event.mode === 'standalone') {
      if (event.source === 'keyboard') {
        getMenu()?.focusItem(active.key);
      }

      return;
    }

    pendingFocus = setTimeout(() => {
      getMenu()?.focusItem(active.key);
    }, activeItemFocusDelay);
  };

  // A press or release outside is a light dismissal: focus stays wherever
  // the pointer put it, never back on the trigger, as with a native menu.
  // Focus already left the menu on its own, so it is not pulled back either.
  const onCancel = (event: MarkingMenuCancelEvent<Model>): void => {
    if (
      event.mode === 'standalone' &&
      (event.source === 'pointer' || event.source === 'focus-loss')
    ) {
      endInteraction();
    } else {
      restoreFocus();
    }
  };

  runtime.on('open', onOpen);
  runtime.on('change', onChange);
  runtime.on('select', restoreFocus);
  runtime.on('cancel', onCancel);

  return {
    dispose() {
      // Disposing mid-gesture: nothing else will ever give the focus this
      // manager moved back to its owner, so this is the last chance to.
      restoreFocus();
      runtime.off('open', onOpen);
      runtime.off('change', onChange);
      runtime.off('select', restoreFocus);
      runtime.off('cancel', onCancel);
    },
  };
}
