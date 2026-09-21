import type { KeyboardIntent, NavigationPhase } from './machine.js';
import type { NavigationInputSink } from './runtime.js';

export type KeyboardSource = {
  dispose: () => void;
};

const intentOf = (key: string): KeyboardIntent | undefined => {
  switch (key) {
    case 'ArrowDown': {
      return 'next';
    }

    case 'ArrowUp': {
      return 'previous';
    }

    case 'Home': {
      return 'first';
    }

    case 'End': {
      return 'last';
    }

    case 'Enter': {
      return 'activate';
    }

    case 'ArrowRight': {
      return 'enter';
    }

    case 'ArrowLeft': {
      return 'leave';
    }

    case 'Escape': {
      return 'escape';
    }

    case 'Tab': {
      return 'exit';
    }

    default: {
      return undefined;
    }
  }
};

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
}: {
  parent: HTMLElement;
  /**
  The menu currently displayed. Input only counts when it comes from inside its layer.
  */
  getMenu: () => { readonly layer: HTMLElement } | undefined;
  runtime: NavigationInputSink & { readonly phase: NavigationPhase };
}): KeyboardSource {
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
    const intent = intentOf(event.key);
    // Shortcuts of the page or the browser are none of the menu's business.
    const isShortcut = event.ctrlKey || event.altKey || event.metaKey;
    if (
      intent === undefined ||
      isShortcut ||
      originInMenu(event) === undefined
    ) {
      return;
    }

    // Tab is what moves focus on to the next element once the menu closed.
    if (intent !== 'exit') {
      event.preventDefault();
    }

    runtime.send({ type: 'keyboard', intent });
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

  parent.addEventListener('keydown', onKeyDown);
  parent.addEventListener('focusin', onFocusIn);

  return {
    dispose() {
      parent.removeEventListener('keydown', onKeyDown);
      parent.removeEventListener('focusin', onFocusIn);
    },
  };
}
