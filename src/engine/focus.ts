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

const shadowRoot = (parent: HTMLElement): ShadowRoot | null =>
  parent.querySelector('.marking-menu')?.shadowRoot ?? null;

const menuContainer = (parent: HTMLElement): HTMLElement | null =>
  shadowRoot(parent)?.querySelector<HTMLElement>('[role="menu"]') ?? null;

const itemElement = (parent: HTMLElement, key: string): HTMLElement | null =>
  [
    ...(shadowRoot(parent)?.querySelectorAll<HTMLElement>(
      '[role="menuitem"]',
    ) ?? []),
  ].find((element) => element.dataset.itemId === key) ?? null;

/**
 Speaks the active item's label by moving real focus: the one mechanism
 announced on every target screen reader (no live region, no
 `aria-activedescendant`). Kept out of `machine.ts`: it reacts to the same
 public events a consumer would, and owns nothing the state machine needs.
 */
export function manageFocus<M extends AnyModelNode>({
  parent,
  runtime,
}: {
  parent: HTMLElement;
  runtime: MarkingMenuEventEmitter<M>;
}): FocusManager {
  let pendingFocus: ReturnType<typeof setTimeout> | undefined;
  let savedFocus: HTMLElement | null = null;

  const clearPendingFocus = (): void => {
    clearTimeout(pendingFocus);
    pendingFocus = undefined;
  };

  const onOpen = (): void => {
    clearPendingFocus();
    savedFocus ??= document.activeElement as HTMLElement | null;
    menuContainer(parent)?.focus({ preventScroll: true });
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
      itemElement(parent, key)?.focus({ preventScroll: true });
    }, ACTIVE_ITEM_FOCUS_DELAY_MS);
  };

  const onEnd = (): void => {
    clearPendingFocus();
    savedFocus?.focus({ preventScroll: true });
    savedFocus = null;
  };

  runtime.on('open', onOpen);
  runtime.on('change', onChange);
  runtime.on('select', onEnd);
  runtime.on('cancel', onEnd);

  return {
    dispose() {
      clearPendingFocus();
      runtime.off('open', onOpen);
      runtime.off('change', onChange);
      runtime.off('select', onEnd);
      runtime.off('cancel', onEnd);
    },
  };
}
