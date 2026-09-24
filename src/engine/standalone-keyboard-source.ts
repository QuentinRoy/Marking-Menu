import type { Menu, MenuEventResolution } from '../layout/menu.js';
import type { KeyboardIntent, NavigationPhase } from './machine.js';
import type { NavigationInputSink } from './runtime.js';

export type StandaloneKeyboardSource = {
  dispose: () => void;
};

const intents = new Map<string, KeyboardIntent>([
  ['ArrowUp', 'up'],
  ['ArrowDown', 'down'],
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
  ['Home', 'first'],
  ['End', 'last'],
  ['Enter', 'activate'],
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
export function createStandaloneKeyboardSource({
  parent,
  getMenu,
  runtime,
}: {
  parent: HTMLElement;
  /**
  The menu currently displayed. Input only counts when it comes from inside it.
  */
  getMenu: () => Pick<Menu, 'resolve' | 'isInside'> | undefined;
  runtime: NavigationInputSink & {
    readonly phase: NavigationPhase;
    readonly isSending: boolean;
  };
}): StandaloneKeyboardSource {
  /**
   Where `event` landed, when a standalone menu is what is open.
   */
  const resolve = (event: Event): MenuEventResolution => {
    const menu = runtime.phase === 'standalone' ? getMenu() : undefined;
    return menu?.resolve(event) ?? { isInside: false };
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const intent = intents.get(event.key);
    // Shortcuts of the page or the browser are none of the menu's business.
    const isShortcut = event.ctrlKey || event.altKey || event.metaKey;
    if (intent === undefined || isShortcut || !resolve(event).isInside) {
      return;
    }

    // Tab moves focus to the next element after the menu closes.
    if (intent !== 'dismiss') {
      event.preventDefault();
    }

    runtime.send({ type: 'keyboard', intent });
  };

  const onFocusIn = (event: FocusEvent): void => {
    const resolution = resolve(event);
    if (resolution.isInside && resolution.itemKey !== undefined) {
      runtime.send({ type: 'focus', key: resolution.itemKey });
    }
  };

  const onFocusOut = (event: FocusEvent): void => {
    // A blur fired as a side effect of our own send — a level's DOM
    // swapped out from under the item that held focus, keyboard- or
    // pointer-caused alike — is not a real focus loss.
    if (runtime.isSending || !resolve(event).isInside) {
      return;
    }

    const { relatedTarget } = event;
    if (!relatedTarget || !getMenu()?.isInside(relatedTarget)) {
      runtime.send({ type: 'focus-loss' });
    }
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
