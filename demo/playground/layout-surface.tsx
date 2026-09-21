import { createMarkingMenu, type MarkingMenuInput } from 'marking-menu';
import { useEffect, useRef } from 'react';
import { pathToNode, subtreeAt } from './menu-tree.js';
import { useLatest } from './use-latest.js';

/*
 The other half of the page: the shipped menu itself, opened standalone
 (`open({ focus: false })`) on the subtree of the edited menu rooted at
 `basePath`, and left displayed without taking focus so it can be read rather
 than performed. The library owns layout, keyboard navigation and submenu
 opening; this file only keeps it open and reports which level it is
 currently showing.
 */

export function LayoutSurface({
  menu,
  basePath,
  onDisplayedPathChange,
}: {
  menu: MarkingMenuInput;
  basePath: readonly number[];
  onDisplayedPathChange: (path: readonly number[]) => void;
}) {
  // Bound to JSX via `ref={}` below: React itself sets `.current` to `null`
  // on unmount, so this must stay `null`-typed.
  /* eslint-disable @typescript-eslint/no-restricted-types -- DOM refs */
  const parentRef = useRef<HTMLDivElement | null>(null);
  /* eslint-enable @typescript-eslint/no-restricted-types -- DOM refs */
  const latestRef = useLatest({ basePath, onDisplayedPathChange });

  useEffect(() => {
    const parent = parentRef.current ?? undefined;
    if (parent === undefined) {
      return;
    }

    const controller = createMarkingMenu({
      parent,
      ...subtreeAt(menu, basePath),
    });

    // A `close()` this effect calls itself (on resize) fires `cancel` like
    // any other; skipped once so the listener below does not race it with a
    // second, redundant `open()`.
    let shouldSkipNextCancel = false;

    // The preview stays open: whatever ends it, the base level it was opened
    // on is shown again right away, unless a resize already reopened it.
    const reopen = () => {
      latestRef.current.onDisplayedPathChange(latestRef.current.basePath);
      controller.open({ focus: false });
    };

    controller.on('change', (event) => {
      latestRef.current.onDisplayedPathChange([
        ...latestRef.current.basePath,
        ...pathToNode(event.menu),
      ]);
    });
    controller.on('select', reopen);
    controller.on('cancel', () => {
      if (shouldSkipNextCancel) {
        shouldSkipNextCancel = false;
        return;
      }

      reopen();
    });

    reopen();

    // The menu is anchored at a pixel centre, so a resized surface needs it
    // closed and reopened rather than merely restyled.
    const observer = new ResizeObserver(() => {
      shouldSkipNextCancel = true;
      controller.close();
      reopen();
    });
    observer.observe(parent);

    return () => {
      observer.disconnect();
      controller.dispose();
    };
  }, [menu, basePath, latestRef]);

  return (
    <div className="relative min-h-85 flex-1 overflow-hidden bg-surface dot-grid wide:min-h-0">
      <div ref={parentRef} className="absolute inset-0" />
    </div>
  );
}
