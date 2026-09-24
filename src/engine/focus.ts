import type {
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
export const deepActiveElement = (doc: Document): Element | undefined => {
  let active = doc.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }

  return active ?? undefined;
};

/**
 Speaks a gesture's active item by moving real focus: the one mechanism
 announced on every target screen reader (no live region, no
 `aria-activedescendant`). A standalone menu's focus is its session's.
 */
export function manageFocus<Model extends ModelNode = ModelNode>({
  doc,
  getMenu,
  runtime,
  submenuOpeningDelay,
}: {
  doc: Document;
  getMenu: () => Pick<Menu, 'focusMenu' | 'focusItem'> | undefined;
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

  const clearPendingFocus = (): void => {
    clearTimeout(pendingFocus);
    pendingFocus = undefined;
  };

  const restoreFocus = (): void => {
    const target = savedFocus;
    clearPendingFocus();
    savedFocus = undefined;
    target?.focus({ preventScroll: true });
  };

  const onOpen = (event: MarkingMenuOpenEvent<Model>): void => {
    if (event.mode === 'standalone') {
      return;
    }

    clearPendingFocus();
    savedFocus ??= deepActiveElement(doc) as HTMLElement | undefined;
    getMenu()?.focusMenu();
  };

  // Waits, so an item the pointer only passes over is not announced.
  const onChange = (event: MarkingMenuChangeEvent<Model>): void => {
    if (event.mode === 'standalone') {
      return;
    }

    const { activeItem } = event;
    clearPendingFocus();
    if (activeItem !== undefined) {
      pendingFocus = setTimeout(() => {
        getMenu()?.focusItem(activeItem.key);
      }, activeItemFocusDelay);
    }
  };

  const onEnd = (event: { readonly mode: string }): void => {
    if (event.mode !== 'standalone') {
      restoreFocus();
    }
  };

  runtime.on('open', onOpen);
  runtime.on('change', onChange);
  runtime.on('select', onEnd);
  runtime.on('cancel', onEnd);

  return {
    dispose() {
      // Disposing mid-gesture: nothing else will ever give focus back.
      restoreFocus();
      runtime.off('open', onOpen);
      runtime.off('change', onChange);
      runtime.off('select', onEnd);
      runtime.off('cancel', onEnd);
    },
  };
}
