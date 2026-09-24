import { createMarkingMenu, type MarkingMenuInput } from 'marking-menu';
import { useEffect, useRef } from 'react';
import { itemsAt, pathToNode } from './menu-tree.js';
import { useLatest } from './use-latest.js';

export function LayoutSurface({
  menu,
  basePath,
  onDisplayedPathChange,
}: {
  menu: MarkingMenuInput;
  basePath: readonly number[];
  onDisplayedPathChange: (path: readonly number[]) => void;
}) {
  // React nulls `.current` on unmount, so this stays `null`-typed.
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
      items: itemsAt(menu, basePath),
    });

    // The preview never really closes: it reopens at its base level
    // whatever ends it.
    const reopen = () => {
      latestRef.current.onDisplayedPathChange(latestRef.current.basePath);
      controller.open({ autoFocus: false });
    };

    controller.on('change', (event) => {
      latestRef.current.onDisplayedPathChange([
        ...latestRef.current.basePath,
        ...pathToNode(event.menu),
      ]);
    });
    controller.on('select', reopen);
    controller.on('cancel', reopen);

    reopen();

    // Anchored at a pixel centre, so a resize needs a close+reopen, not a
    // restyle: closing cancels, and cancelling reopens.
    const observer = new ResizeObserver(() => {
      controller.close();
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
