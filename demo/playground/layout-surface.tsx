import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';
import { createMenu } from '../../src/layout/menu.js';
import { nodeAt, type MenuModel } from './menu-model.js';
import { useLatest } from './use-latest.js';

/*
 The other half of the page: one level of the menu, laid out by the library
 at the centre of the surface and standing still, so it can be read rather
 than performed. Clicking an item selects it; clicking the selected item
 goes a level deeper. Clicking empty space deselects; double-clicking it goes
 back to the root.
 */

// The menu lives in a shadow root: a listener outside it only ever sees
// `event.target` retargeted to the shadow host, never the wedge or item
// actually under the pointer. `composedPath()` isn't retargeted.
function hitItemId(event: Event): string | undefined {
  const target = event.composedPath()[0];
  if (!(target instanceof Element)) {
    return undefined;
  }

  const hit = target.closest('[data-item-id]');
  return hit instanceof HTMLElement || hit instanceof SVGElement
    ? hit.dataset.itemId
    : undefined;
}

export function LayoutSurface({
  model,
  focusPath,
  onFocus,
}: {
  model: MenuModel;
  focusPath: readonly number[];
  onFocus: (path: readonly number[]) => void;
}) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const menuParentRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<ReturnType<typeof createMenu> | null>(null);
  // The selected-but-not-yet-opened item, read and written imperatively:
  // nothing in JSX depends on it, `Menu.setActive` is what makes it visible.
  const activeKeyRef = useRef<string | null>(null);
  const latestRef = useLatest({ model, focusPath, onFocus });

  useEffect(() => {
    const surface = surfaceRef.current;
    const menuParent = menuParentRef.current;
    if (surface === null || menuParent === null) {
      return;
    }

    // A new level starts with nothing selected: a key selected at the
    // previous level may not exist at this one, and `setActive` throws for
    // an id it can't find.
    activeKeyRef.current = null;
    const render = () => {
      menuRef.current?.remove();
      const { width, height } = surface.getBoundingClientRect();
      const menu = createMenu({
        parent: menuParent,
        model: nodeAt(model, focusPath),
        center: [width / 2, height / 2],
        pointerTarget: true,
      });
      menu.setActive(activeKeyRef.current);
      menuRef.current = menu;
    };

    render();
    // The menu is anchored at a pixel centre, so a resized surface needs it
    // laid out again rather than merely restyled.
    const observer = new ResizeObserver(render);
    observer.observe(surface);
    return () => {
      observer.disconnect();
      menuRef.current?.remove();
      menuRef.current = null;
    };
  }, [model, focusPath]);

  const onClick = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) {
      return;
    }

    const itemId = hitItemId(event.nativeEvent);
    if (itemId === undefined) {
      if (activeKeyRef.current !== null) {
        activeKeyRef.current = null;
        menuRef.current?.setActive(null);
      }

      return;
    }

    if (itemId !== activeKeyRef.current) {
      activeKeyRef.current = itemId;
      menuRef.current?.setActive(itemId);
      return;
    }

    const latest = latestRef.current;
    const node = nodeAt(latest.model, latest.focusPath);
    const index = node.items.findIndex((item) => item.key === itemId);
    const item = index === -1 ? undefined : node.items[index];
    if (item !== undefined && !item.isLeaf) {
      latest.onFocus([...latest.focusPath, index]);
    }
  };

  const onDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const latest = latestRef.current;
    if (
      hitItemId(event.nativeEvent) === undefined &&
      latest.focusPath.length > 0
    ) {
      latest.onFocus([]);
    }
  };

  return (
    <div
      ref={surfaceRef}
      onPointerDown={onClick}
      onDoubleClick={onDoubleClick}
      className="relative min-h-85 flex-1 overflow-hidden bg-surface dot-grid wide:min-h-0"
    >
      <div ref={menuParentRef} className="absolute inset-0" />
      <span className="pointer-events-none absolute bottom-4 left-5 font-mono text-meta text-quietest">
        click an item to select it, click again to go a level deeper, click
        empty space to deselect, or double-click it for the root
      </span>
    </div>
  );
}
