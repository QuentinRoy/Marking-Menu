import { useEffect, useRef, type PointerEvent } from 'react';
import { createMenu } from '../../src/layout/menu.js';
import { segmentAngle } from '../../src/recognizer/recognize-mm-stroke.js';
import { dist, type Point } from '../../src/utils.js';
import { nodeAt, type MenuModel } from './menu-model.js';

/*
 The other half of the page: one level of the menu, laid out by the library
 at the centre of the surface and standing still, so it can be read rather
 than performed. Clicking an item with a sub-menu goes a level deeper.
 */

// A click this close to the centre reads no direction, so it selects
// nothing. The menu itself is `pointer-events: none` (see `menu.css`), so a
// click is resolved by angle, the way the recognizer resolves a stroke, and
// not by which element sits underneath it.
const MIN_SELECTION_DIST_PX = 20;

export function PreviewSurface({
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
  const latestRef = useRef({ model, focusPath, onFocus });
  useEffect(() => {
    latestRef.current = { model, focusPath, onFocus };
  });

  useEffect(() => {
    const surface = surfaceRef.current;
    const menuParent = menuParentRef.current;
    if (surface === null || menuParent === null) {
      return;
    }

    let menu: ReturnType<typeof createMenu> | null = null;
    const render = () => {
      menu?.remove();
      const { width, height } = surface.getBoundingClientRect();
      menu = createMenu({
        parent: menuParent,
        model: nodeAt(model, focusPath),
        center: [width / 2, height / 2],
      });
    };

    render();
    // The menu is anchored at a pixel centre, so a resized surface needs it
    // laid out again rather than merely restyled.
    const observer = new ResizeObserver(render);
    observer.observe(surface);
    return () => {
      observer.disconnect();
      menu?.remove();
    };
  }, [model, focusPath]);

  const onClick = (event: PointerEvent<HTMLDivElement>) => {
    const surface = surfaceRef.current;
    if (surface === null || !event.isPrimary) {
      return;
    }

    const { width, height, left, top } = surface.getBoundingClientRect();
    const center: Point = [width / 2, height / 2];
    const point: Point = [event.clientX - left, event.clientY - top];
    const node = nodeAt(latestRef.current.model, latestRef.current.focusPath);
    if (node.isLeaf || dist(center, point) < MIN_SELECTION_DIST_PX) {
      return;
    }

    const item = node.getNearestChild(segmentAngle(center, point));
    const index = node.items.findIndex(
      (candidate) => candidate.key === item?.key,
    );
    if (index === -1 || item === null || item.isLeaf) {
      return;
    }

    latestRef.current.onFocus([...latestRef.current.focusPath, index]);
  };

  return (
    <div
      ref={surfaceRef}
      onPointerDown={onClick}
      className="bg-surface relative min-h-[340px] flex-1 overflow-hidden [background-image:radial-gradient(var(--color-dot)_1px,transparent_1px)] [background-size:22px_22px] min-[621px]:min-h-0"
    >
      <div ref={menuParentRef} className="menu-layer absolute inset-0" />
      <span className="text-quietest pointer-events-none absolute bottom-4 left-5 font-mono text-[11.5px]">
        click an item with a sub-menu to go a level deeper
      </span>
    </div>
  );
}
