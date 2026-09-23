import { toClientPoint } from '../utils.js';
import type { NavigationPhase } from './machine.js';
import type { NavigationInputSink } from './runtime.js';

export type StandalonePointerSource = {
  dispose: () => void;
};

// `instanceof HTMLElement` would use this module's realm's constructor,
// which a node from another document/window (a `parent` inside an iframe)
// never matches; see the same pitfall worked around in `layout/menu.ts`.
const isElement = (node: EventTarget): node is HTMLElement =>
  'nodeType' in node && node.nodeType === Node.ELEMENT_NODE;

/**
 The item under an event, resolved by walking its `composedPath()` for the
 nearest `.marking-menu-item` ancestor of the actual target: unlike focus,
 a pointer event's target is rarely the item element itself, but one of its
 descendants (the plate, its label, or a wedge).
 */
const resolveItemKey = (event: PointerEvent): string | undefined => {
  for (const node of event.composedPath()) {
    if (isElement(node) && node.classList.contains('marking-menu-item')) {
      return node.dataset.itemId;
    }
  }

  return undefined;
};

/**
 Native pointer listeners for a standalone menu: delegated hover, held
 contact, and release, resolved through `composedPath()` rather than
 pointer capture, so a drag keeps reporting whichever item is actually
 under it. Unlike a gesture, it never captures the pointer, prevents a
 default, or claims `touch-action`; it only reads what the standalone
 pointer source's own primary contact is doing while one is displayed.
 */
export function createStandalonePointerSource({
  parent,
  doc = parent.ownerDocument,
  getMenu,
  runtime,
}: {
  parent: HTMLElement;
  doc?: Document;
  getMenu: () => { readonly layer: HTMLElement } | undefined;
  runtime: NavigationInputSink & { readonly phase: NavigationPhase };
}): StandalonePointerSource {
  let activePointerId: number | undefined;

  const isOpen = (): boolean => runtime.phase === 'standalone';

  const isPrimaryPress = (event: PointerEvent): boolean =>
    event.isPrimary && event.button === 0;

  /**
   Whether `event` originated inside the displayed level's own layer. The
   rest of `parent`, gaps between items included, is outside the menu.
   */
  const isInLayer = (event: PointerEvent): boolean => {
    const layer = getMenu()?.layer;
    return layer !== undefined && event.composedPath().includes(layer);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (activePointerId !== undefined || !isPrimaryPress(event) || !isOpen()) {
      return;
    }

    // A primary press elsewhere on `parent` (not on the menu itself) is an
    // outside press too, handled here rather than by the wider document
    // listener below: by the time this bubble-phase handler runs, the
    // gesture pointer source's own bubble listener on `parent` has already
    // run once for this same event, and dismissing (which resumes it)
    // cannot make it run again for an event it already saw.
    if (!isInLayer(event)) {
      runtime.send({
        type: 'standalonePointer.outside',
        position: toClientPoint(event),
      });
      return;
    }

    activePointerId = event.pointerId;
    runtime.send({
      type: 'standalonePointer.move',
      position: toClientPoint(event),
      itemKey: resolveItemKey(event),
    });
  };

  // Also handles `pointerout`, which never reaches `parent` for a move between
  // parts of the menu: its target and `relatedTarget` both retarget to the
  // shadow host, which stops it there. One seen here left the menu.
  const onPointerMove = (event: PointerEvent): void => {
    if (
      !isOpen() ||
      (activePointerId !== undefined && event.pointerId !== activePointerId) ||
      !isInLayer(event)
    ) {
      return;
    }

    runtime.send({
      type: 'standalonePointer.move',
      position: toClientPoint(event),
      itemKey: event.type === 'pointerout' ? undefined : resolveItemKey(event),
    });
  };

  // On the document: a held contact can be released anywhere.
  const onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    // Cleared even once closed, or the next session would ignore its press.
    activePointerId = undefined;
    if (!isOpen()) {
      return;
    }

    const position = toClientPoint(event);
    if (!isInLayer(event)) {
      runtime.send({ type: 'standalonePointer.outside', position });
      return;
    }

    runtime.send({
      type: 'standalonePointer.activate',
      position,
      itemKey: resolveItemKey(event),
    });
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    activePointerId = undefined;
    if (!isOpen()) {
      return;
    }

    runtime.send({
      type: 'standalonePointer.cancel',
      position: toClientPoint(event),
    });
  };

  // Capture phase, on the document: a press outside `parent` altogether
  // never reaches `onPointerDown` above (`parent` is not on its path), so
  // catching it needs a wider-reaching listener. A press inside `parent`
  // is `onPointerDown`'s to handle instead, event identity included.
  const onOutsidePointerDown = (event: PointerEvent): void => {
    if (
      !isOpen() ||
      !isPrimaryPress(event) ||
      // `composedPath()`, not `.target`: a listener outside `parent`'s own
      // shadow tree (this one, on `doc`) sees `.target` retargeted to that
      // tree's host, which `parent.contains()` never finds as a descendant
      // even though the real target is one, wrongly flagging every inside
      // press on a shadow-hosted `parent` as outside.
      event.composedPath().includes(parent)
    ) {
      return;
    }

    runtime.send({
      type: 'standalonePointer.outside',
      position: toClientPoint(event),
    });
  };

  parent.addEventListener('pointerdown', onPointerDown);
  parent.addEventListener('pointermove', onPointerMove);
  parent.addEventListener('pointerout', onPointerMove);
  parent.addEventListener('pointercancel', onPointerCancel);
  doc.addEventListener('pointerdown', onOutsidePointerDown, { capture: true });
  doc.addEventListener('pointerup', onPointerUp, { capture: true });

  return {
    dispose() {
      parent.removeEventListener('pointerdown', onPointerDown);
      parent.removeEventListener('pointermove', onPointerMove);
      parent.removeEventListener('pointerout', onPointerMove);
      parent.removeEventListener('pointercancel', onPointerCancel);
      doc.removeEventListener('pointerdown', onOutsidePointerDown, {
        capture: true,
      });
      doc.removeEventListener('pointerup', onPointerUp, { capture: true });
    },
  };
}
