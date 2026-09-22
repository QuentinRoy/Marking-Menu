import type { KeyboardIntent, NavigationPhase } from './machine.js';
import type { NavigationInputSink } from './runtime.js';

export type KeyboardSource = {
  dispose: () => void;
};

const intents = new Map<string, KeyboardIntent>([
  ['ArrowDown', 'next'],
  ['ArrowUp', 'previous'],
  ['Home', 'first'],
  ['End', 'last'],
  ['Enter', 'activate'],
  ['ArrowRight', 'enter'],
  ['ArrowLeft', 'leave'],
  ['Escape', 'back'],
  ['Tab', 'dismiss'],
]);

/**
 Native keyboard listeners: turns `keydown` into the machine's intents and
 `focusin` into the item that took focus. Platform focus is the input, so an
 item is active because it holds focus. Only a standalone menu takes either:
 a gesture is driven by the pointer, and its own focus moves must not come
 back as input.
 */
export function createKeyboardSource({
  parent,
  getMenu,
  runtime,
  onFocusLoss,
}: {
  parent: HTMLElement;
  /**
  The menu currently displayed. Input only counts when it comes from inside its layer.
  */
  getMenu: () => { readonly layer: HTMLElement } | undefined;
  runtime: NavigationInputSink & { readonly phase: NavigationPhase };
  onFocusLoss: () => void;
}): KeyboardSource {
  let isHandlingKeyboardIntent = false;

  /**
   The first node an event went through, when the event started inside the
   menu that is displayed and a standalone menu is what is open. `parent` is
   a light DOM ancestor of the menu's shadow root, so the event is
   retargeted by the time it gets here and only its composed path still
   tells where it came from.
   */
  const originInMenu = (event: Event): EventTarget | undefined => {
    const layer = getMenu()?.layer;
    if (layer === undefined || runtime.phase !== 'standalone') {
      return undefined;
    }

    const path = event.composedPath();
    return path.includes(layer) ? path[0] : undefined;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const intent = intents.get(event.key);
    // Shortcuts of the page or the browser are none of the menu's business.
    const isShortcut = event.ctrlKey || event.altKey || event.metaKey;
    if (
      intent === undefined ||
      isShortcut ||
      originInMenu(event) === undefined
    ) {
      return;
    }

    // Tab moves focus to the next element after the menu closes.
    if (intent !== 'dismiss') {
      event.preventDefault();
    }

    isHandlingKeyboardIntent = true;
    try {
      runtime.send({ type: 'keyboard', intent });
    } finally {
      isHandlingKeyboardIntent = false;
    }
  };

  const onFocusIn = (event: FocusEvent): void => {
    const origin = originInMenu(event);
    if (!(origin instanceof HTMLElement)) {
      return;
    }

    const key = origin.classList.contains('marking-menu-item')
      ? origin.dataset.itemId
      : undefined;
    if (key !== undefined) {
      runtime.send({ type: 'focus', key });
    }
  };

  const closeForFocusLoss = (): void => {
    onFocusLoss();
    runtime.send({ type: 'keyboard', intent: 'dismiss' });
  };

  const onFocusOut = (event: FocusEvent): void => {
    const layer = getMenu()?.layer;
    if (
      layer === undefined ||
      isHandlingKeyboardIntent ||
      originInMenu(event) === undefined
    ) {
      return;
    }

    if (!event.relatedTarget) {
      closeForFocusLoss();
      return;
    }

    const root = layer.getRootNode();
    if (
      layer.contains(event.relatedTarget as Node) ||
      ('host' in root && event.relatedTarget === root.host)
    ) {
      return;
    }

    closeForFocusLoss();
  };

  parent.addEventListener('keydown', onKeyDown);
  parent.addEventListener('focusin', onFocusIn);
  parent.addEventListener('focusout', onFocusOut);

  return {
    dispose() {
      parent.removeEventListener('keydown', onKeyDown);
      parent.removeEventListener('focusin', onFocusIn);
      parent.removeEventListener('focusout', onFocusOut);
    },
  };
}
