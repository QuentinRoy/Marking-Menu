import type {
  MarkingMenuCancelEvent,
  MarkingMenuChangeEvent,
  MarkingMenuOpenEvent,
  MarkingMenuSelectEvent,
} from '../events.js';
import type { Menu, MenuEventResolution } from '../layout/menu.js';
import type { ModelNode } from '../types.js';
import { toClientPoint, type Point } from '../utils.js';
import { deepActiveElement } from './focus.js';
import { createGesturePointerSource } from './gesture-pointer-source.js';
import type { KeyboardIntent } from './machine.js';
import type { NavigationRuntime, NavigationSend } from './runtime.js';

export type StandaloneSession = {
  /**
  Display the root menu on its own. Throws unless the runtime is idle.
  */
  open: (
    position: Point,
    options?: { readonly autoFocus?: boolean | undefined },
  ) => void;
  /**
  Close a standalone menu. Throws unless one is open.
  */
  close: () => void;
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

// `instanceof HTMLElement` fails for a node from another realm, such as a
// `parent` inside an iframe.
const isElement = (node: EventTarget): node is HTMLElement =>
  'nodeType' in node && node.nodeType === Node.ELEMENT_NODE;

const isPrimaryPress = (event: PointerEvent): boolean =>
  event.isPrimary && event.button === 0;

/**
 Everything a standalone menu does in the DOM: keyboard, platform focus and
 pointer input, focus save and restore, and leaving the pointer to the page
 while the menu is open. Whether it is open is read from `runtime.phase`.

 Platform focus is the input: an item is active because it holds focus. The
 pointer is resolved through `composedPath()` rather than capture, so a drag
 reports whichever item is under it.
 */
export function createStandaloneSession<Model extends ModelNode = ModelNode>({
  parent,
  doc = parent.ownerDocument,
  getMenu,
  runtime,
}: {
  parent: HTMLElement;
  doc?: Document;
  /**
  The menu currently displayed. Input only counts when it comes from inside it.
  */
  getMenu: () =>
    | Pick<
        Menu,
        'resolve' | 'isInside' | 'focusMenu' | 'focusItem' | 'focusTabStop'
      >
    | undefined;
  runtime: Pick<
    NavigationRuntime<Model>,
    'send' | 'phase' | 'open' | 'close' | 'on' | 'off'
  >;
}): StandaloneSession {
  // Created before this session's own `pointerdown` listener on `parent`, so
  // it runs first: an outside press seen below resumes the gesture, which
  // must not then start from that same press.
  const gesture = createGesturePointerSource({ parent, runtime });

  let isDisposed = false;
  let savedFocus: HTMLElement | undefined;
  let activePointerId: number | undefined;
  let pressedMenu: ReturnType<typeof getMenu>;
  let sendDepth = 0;

  const isOpen = (): boolean => runtime.phase === 'standalone';

  /**
   Runs `drive` flagged as this session's own: a focus change it causes, such
   as a level's DOM swapped from under the focused item, is not a focus loss.
   A depth, since a send can trigger another before it returns.
   */
  const asOwnInput = (drive: () => void): void => {
    sendDepth += 1;
    try {
      drive();
    } finally {
      sendDepth -= 1;
    }
  };

  const send: NavigationSend = (...input) => {
    asOwnInput(() => {
      runtime.send(...input);
    });
  };

  // `open()` focuses the first item, and that focus is its doing, not a key's.
  let focusSource: 'keyboard' | 'api' = 'keyboard';

  const resolve = (event: Event): MenuEventResolution =>
    (isOpen() ? getMenu()?.resolve(event) : undefined) ?? { isInside: false };

  const onKeyDown = (event: KeyboardEvent): void => {
    const intent = intents.get(event.key);
    const isShortcut = event.ctrlKey || event.altKey || event.metaKey;
    if (intent === undefined || isShortcut || !resolve(event).isInside) {
      return;
    }

    // Tab moves focus on once the menu closes.
    if (intent !== 'dismiss') {
      event.preventDefault();
    }

    if (intent === 'dismiss') {
      send('dismiss', { source: 'keyboard' });
    } else {
      send(intent);
    }
  };

  const onFocusIn = (event: FocusEvent): void => {
    const resolution = resolve(event);
    if (resolution.isInside && resolution.itemKey !== undefined) {
      send('focus', { key: resolution.itemKey, source: focusSource });
    }
  };

  const onFocusOut = (event: FocusEvent): void => {
    if (sendDepth > 0 || !resolve(event).isInside) {
      return;
    }

    const { relatedTarget } = event;
    if (!relatedTarget || !getMenu()?.isInside(relatedTarget)) {
      send('dismiss', { source: 'focus-loss' });
    }
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (activePointerId !== undefined || !isPrimaryPress(event) || !isOpen()) {
      return;
    }

    const resolution = resolve(event);
    if (!resolution.isInside) {
      send('standalonePointerOutside', { position: toClientPoint(event) });
      return;
    }

    activePointerId = event.pointerId;
    pressedMenu = getMenu();
    // Browsers capture a touch or pen contact to the element it pressed.
    // Letting go makes each later event report what is under the contact.
    const [target] = event.composedPath();
    if (
      target !== undefined &&
      isElement(target) &&
      target.hasPointerCapture(event.pointerId)
    ) {
      target.releasePointerCapture(event.pointerId);
    }

    send('standalonePointerMove', {
      position: toClientPoint(event),
      itemKey: resolution.itemKey,
    });
  };

  const isTracked = (event: PointerEvent): boolean =>
    isOpen() &&
    (activePointerId === undefined || event.pointerId === activePointerId);

  const onPointerMove = (event: PointerEvent): void => {
    if (!isTracked(event)) {
      return;
    }

    const resolution = resolve(event);
    if (resolution.isInside) {
      send('standalonePointerMove', {
        position: toClientPoint(event),
        itemKey: resolution.itemKey,
      });
    }
  };

  // A move between parts of the menu never reaches `parent`: its target and
  // `relatedTarget` both retarget to the shadow host, which stops it there.
  const onPointerOut = (event: PointerEvent): void => {
    if (!isTracked(event) || !resolve(event).isInside) {
      return;
    }

    send('standalonePointerMove', {
      position: toClientPoint(event),
      itemKey: undefined,
    });
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    activePointerId = undefined;
    if (isOpen()) {
      send('standalonePointerCancel', { position: toClientPoint(event) });
    }
  };

  // On the document: a held contact can be released anywhere.
  const onDocumentPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    // Cleared regardless, or the next menu would ignore its press. A release
    // only acts on the level it was pressed on.
    activePointerId = undefined;
    if (!isOpen() || getMenu() !== pressedMenu) {
      return;
    }

    const position = toClientPoint(event);
    const resolution = resolve(event);
    if (resolution.isInside) {
      send('standalonePointerActivate', {
        position,
        itemKey: resolution.itemKey,
      });
    } else {
      send('standalonePointerOutside', { position });
    }
  };

  // A press outside `parent` never reaches `onPointerDown`. `composedPath()`,
  // not `target`: from the document, a `parent` in a shadow tree is hidden
  // behind its host.
  const onDocumentPointerDown = (event: PointerEvent): void => {
    if (
      !isOpen() ||
      !isPrimaryPress(event) ||
      event.composedPath().includes(parent)
    ) {
      return;
    }

    send('standalonePointerOutside', { position: toClientPoint(event) });
  };

  const forgetFocus = (): void => {
    savedFocus = undefined;
  };

  const restoreFocus = (): void => {
    const target = savedFocus;
    forgetFocus();
    target?.focus({ preventScroll: true });
  };

  const onOpen = (event: MarkingMenuOpenEvent<Model>): void => {
    if (event.mode !== 'standalone') {
      return;
    }

    // Only the root opens from the API. A level entered with a key is
    // focused by the `change` that follows; one a pointer release opened has
    // no such `change`.
    if (event.source !== 'api') {
      if (event.source === 'pointer') {
        getMenu()?.focusMenu();
      }

      return;
    }

    gesture.suspend();
    // Saved even without autofocus: a pointer release may still move focus
    // into a submenu.
    savedFocus = deepActiveElement(doc) as HTMLElement | undefined;
    if (!event.willAutoFocus) {
      return;
    }

    // Reported back as a `focus` input, which makes the first item active.
    focusSource = 'api';
    try {
      getMenu()?.focusTabStop();
    } finally {
      focusSource = 'keyboard';
    }
  };

  const onChange = (event: MarkingMenuChangeEvent<Model>): void => {
    // A pointer-caused change never moves focus.
    if (
      event.mode === 'standalone' &&
      event.source === 'keyboard' &&
      event.activeItem !== undefined
    ) {
      getMenu()?.focusItem(event.activeItem.key);
    }
  };

  const onSelect = (event: MarkingMenuSelectEvent<Model>): void => {
    if (event.mode !== 'standalone') {
      return;
    }

    gesture.resume();
    restoreFocus();
  };

  // A dismissal by the pointer or by focus loss leaves focus where it went,
  // as with a native menu.
  const onCancel = (event: MarkingMenuCancelEvent<Model>): void => {
    if (event.mode !== 'standalone') {
      return;
    }

    gesture.resume();
    if (event.source === 'pointer' || event.source === 'focus-loss') {
      forgetFocus();
    } else {
      restoreFocus();
    }
  };

  parent.addEventListener('keydown', onKeyDown);
  parent.addEventListener('focusin', onFocusIn);
  parent.addEventListener('focusout', onFocusOut);
  parent.addEventListener('pointerdown', onPointerDown);
  parent.addEventListener('pointermove', onPointerMove);
  parent.addEventListener('pointerout', onPointerOut);
  parent.addEventListener('pointercancel', onPointerCancel);
  doc.addEventListener('pointerdown', onDocumentPointerDown, { capture: true });
  doc.addEventListener('pointerup', onDocumentPointerUp, { capture: true });
  runtime.on('open', onOpen);
  runtime.on('change', onChange);
  runtime.on('select', onSelect);
  runtime.on('cancel', onCancel);

  return {
    open(position, options) {
      asOwnInput(() => {
        runtime.open(position, options);
      });
    },
    close() {
      asOwnInput(() => {
        runtime.close();
      });
    },
    dispose() {
      if (isDisposed) {
        return;
      }

      isDisposed = true;
      parent.removeEventListener('keydown', onKeyDown);
      parent.removeEventListener('focusin', onFocusIn);
      parent.removeEventListener('focusout', onFocusOut);
      parent.removeEventListener('pointerdown', onPointerDown);
      parent.removeEventListener('pointermove', onPointerMove);
      parent.removeEventListener('pointerout', onPointerOut);
      parent.removeEventListener('pointercancel', onPointerCancel);
      doc.removeEventListener('pointerdown', onDocumentPointerDown, {
        capture: true,
      });
      doc.removeEventListener('pointerup', onDocumentPointerUp, {
        capture: true,
      });
      runtime.off('open', onOpen);
      runtime.off('change', onChange);
      runtime.off('select', onSelect);
      runtime.off('cancel', onCancel);
      gesture.dispose();
      // Nothing else will give focus back once the listeners are gone.
      restoreFocus();
    },
  };
}
