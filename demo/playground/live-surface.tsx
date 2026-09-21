import {
  createMarkingMenu,
  type MarkingMenuInput,
  type MarkingMenuMode,
  type MarkingMenuRecognition,
  type Point,
} from 'marking-menu';
import { useCallback, useEffect, useRef } from 'react';
import { pathToNode, stepsAlong, type MenuStep } from './menu-tree.js';
import { useLatest } from './use-latest.js';

/*
 The shipped menu, on its own surface. The library owns dwelling, sub-menu
 opening, expert detection and the stroke; this file adds the readout and
 the recognizer overlay drawn from `select`/`cancel`.
 */

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

// A stroke shorter than this is pointer wobble between a press and a
// release, not a gesture worth reporting on.
const CLICK_MOVEMENT_PX = 8;

/**
 What a finished gesture left on screen: the path it selected, or the
 sentence saying why it selected nothing, plus what the recognizer did.
 */
export type GestureResult = {
  readonly steps: readonly MenuStep[] | undefined;
  readonly message: string;
  readonly metrics: string;
};

/**
The readout before any gesture, and after one too short to count.
*/
export const IDLE_RESULT: GestureResult = {
  steps: undefined,
  message:
    'Press and hold to open the menu, then draw to an item; or draw the mark straight away.',
  metrics: '',
};

function pathLength(points: readonly Point[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const current = points[index];
    if (previous !== undefined && current !== undefined) {
      total += Math.hypot(current[0] - previous[0], current[1] - previous[1]);
    }
  }

  return total;
}

function pathData(points: readonly Point[]): string {
  const [first, ...rest] = points;
  if (first === undefined) {
    return '';
  }

  return `M ${first[0]} ${first[1]} ${rest
    .map(([x, y]) => `L ${x} ${y}`)
    .join(' ')}`;
}

/**
 Draws a finished gesture: the stroke, dimmed, then the pieces and corners
 on top. Colors read from the page's own CSS properties, so the legend can't
 drift from what's drawn.
 */
function drawGesture({
  overlay,
  toLocal,
  recognition,
}: {
  overlay: HTMLElement;
  toLocal: (point: Point) => Point;
  recognition: MarkingMenuRecognition;
}): SVGSVGElement {
  const doc = overlay.ownerDocument;
  const style = getComputedStyle(doc.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const tokenNumber = (name: string) => Number(token(name));

  const svg = doc.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  overlay.append(svg);

  const addPath = (
    points: readonly Point[],
    color: string,
    width: number,
  ): void => {
    const path = doc.createElementNS(SVG_NAMESPACE, 'path');
    path.setAttribute('d', pathData(points));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', String(width));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.append(path);
  };

  // Dimmed, so the pieces on top of it stay legible.
  addPath(
    recognition.stroke.map((point) => toLocal(point)),
    token('--color-stroke-trace'),
    tokenNumber('--mm-stroke-width'),
  );

  // Alternate colors: consecutive pieces stay distinct where they meet.
  const [colorA, colorB] = [token('--color-mark'), token('--color-piece-alt')];
  for (const [index, segment] of recognition.analysis.segments.entries()) {
    addPath(
      segment.points.map((point) => toLocal(point)),
      index % 2 === 0 ? colorA : colorB,
      tokenNumber('--stroke-piece-width'),
    );
  }

  const cornerColor = token('--color-ink');
  const cornerRadius = tokenNumber('--stroke-corner-radius');
  for (const point of recognition.analysis.articulationPoints) {
    const [x, y] = toLocal(point);
    const circle = doc.createElementNS(SVG_NAMESPACE, 'circle');
    circle.setAttribute('cx', String(x));
    circle.setAttribute('cy', String(y));
    circle.setAttribute('r', String(cornerRadius));
    circle.setAttribute('fill', cornerColor);
    svg.append(circle);
  }

  return svg;
}

/**
 What decided a gesture the recognizer had no part in: a novice release
 hit-tests the already-highlighted item, an interrupted pointer never
 reaches the recognizer either. A missing `recognition` is the only signal.
 */
function decidedBy(mode: MarkingMenuMode, wasInterrupted: boolean): string {
  if (wasInterrupted) {
    return 'interrupted, nothing recognized';
  }

  return mode === 'novice'
    ? 'chosen from the open menu, not recognized'
    : 'nothing recognized';
}

export function LiveSurface({
  menu,
  showBreakdown,
  onResult,
}: {
  menu: MarkingMenuInput;
  showBreakdown: boolean;
  onResult: (result: GestureResult) => void;
}) {
  // React nulls `.current` on unmount, so these stay `null`-typed.
  /* eslint-disable @typescript-eslint/no-restricted-types -- DOM refs */
  const menuParentRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  /* eslint-enable @typescript-eslint/no-restricted-types -- DOM refs */
  const svgRef = useRef<SVGSVGElement | undefined>(undefined);
  const strokeRef = useRef<Point[]>([]);
  const interruptedRef = useRef(false);
  // Last recognition to redraw from; undefined when the recognizer had no
  // part (see decidedBy).
  const recognitionRef = useRef<MarkingMenuRecognition | undefined>(undefined);
  const latestRef = useLatest({ menu, showBreakdown, onResult });

  const clearOverlay = useCallback(() => {
    svgRef.current?.remove();
    svgRef.current = undefined;
  }, []);

  useEffect(() => {
    const menuParent = menuParentRef.current ?? undefined;
    if (menuParent === undefined) {
      return;
    }

    const toLocal = (point: Point): Point => {
      const rect = menuParent.getBoundingClientRect();
      return [point[0] - rect.left, point[1] - rect.top];
    };

    const draw = (recognition: MarkingMenuRecognition) => {
      const overlay = overlayRef.current ?? undefined;
      if (overlay !== undefined) {
        svgRef.current = drawGesture({ overlay, toLocal, recognition });
      }
    };

    const finish = (
      position: Point,
      mode: MarkingMenuMode,
      recognition: MarkingMenuRecognition | undefined,
      outcome: { steps: readonly MenuStep[] | undefined; message: string },
    ) => {
      const { showBreakdown: showBreakdownNow, onResult: report } =
        latestRef.current;
      const stroke = [...strokeRef.current, toLocal(position)];
      strokeRef.current = stroke;
      clearOverlay();
      recognitionRef.current = undefined;
      if (pathLength(stroke) < CLICK_MOVEMENT_PX) {
        report(IDLE_RESULT);
        return;
      }

      const depth = outcome.steps?.length ?? 0;
      if (recognition === undefined) {
        // No recognition, nothing to draw or quote.
        report({
          ...outcome,
          metrics: [
            mode,
            `depth ${depth}`,
            decidedBy(mode, interruptedRef.current),
          ].join(' · '),
        });
        return;
      }

      recognitionRef.current = recognition;
      if (showBreakdownNow) {
        draw(recognition);
      }

      report({
        ...outcome,
        metrics: [
          mode,
          `depth ${depth}`,
          `${recognition.analysis.segments.length} piece(s)`,
          `${recognition.analysis.articulationPoints.length} corner(s)`,
        ].join(' · '),
      });
    };

    const controller = createMarkingMenu({
      parent: menuParent,
      ...menu,
      // Off: the library draws its own completed-gesture trace untouched.
      // On: the overlay covers that same stroke, so the library's copy is
      // switched off instead of drawn twice.
      ...(showBreakdown && { gestureFeedbackDuration: 0 }),
    });

    // Captured so this runs before the library's own listener dispatches
    // `cancel` — the event itself can't tell an interrupted pointer from any
    // other cancel.
    const onPointerCancel = () => {
      interruptedRef.current = true;
    };

    menuParent.addEventListener('pointercancel', onPointerCancel, {
      capture: true,
    });

    controller.on('start', (event) => {
      interruptedRef.current = false;
      recognitionRef.current = undefined;
      clearOverlay();
      strokeRef.current = [toLocal(event.position)];
      latestRef.current.onResult({
        steps: undefined,
        message: 'Drawing…',
        metrics: '',
      });
    });
    controller.on('move', (event) => {
      strokeRef.current.push(toLocal(event.position));
    });
    controller.on('select', (event) => {
      // This surface never opens a standalone menu.
      if (event.mode === 'standalone') {
        return;
      }

      const path = pathToNode(event.selection);
      finish(event.position, event.mode, event.recognition, {
        steps: stepsAlong(latestRef.current.menu, path),
        message: '',
      });
    });
    controller.on('cancel', (event) => {
      if (event.mode === 'standalone') {
        return;
      }

      const { active } = event;
      finish(event.position, event.mode, event.recognition, {
        steps: undefined,
        message:
          active === undefined
            ? 'No selection: the stroke does not lead to an item.'
            : `No selection: released on the sub-menu “${active.label}”.`,
      });
    });

    return () => {
      menuParent.removeEventListener('pointercancel', onPointerCancel, {
        capture: true,
      });
      controller.dispose();
      clearOverlay();
    };
  }, [clearOverlay, latestRef, menu, showBreakdown]);

  // Toggling the breakdown redraws the last gesture instead of waiting for
  // the next one; only one the recognizer ran on has anything to redraw.
  useEffect(() => {
    const overlay = overlayRef.current ?? undefined;
    const menuParent = menuParentRef.current ?? undefined;
    const recognition = recognitionRef.current;
    if (
      overlay === undefined ||
      menuParent === undefined ||
      recognition === undefined
    ) {
      return;
    }

    clearOverlay();
    if (!showBreakdown) {
      return;
    }

    const toLocal = (point: Point): Point => {
      const rect = menuParent.getBoundingClientRect();
      return [point[0] - rect.left, point[1] - rect.top];
    };

    svgRef.current = drawGesture({ overlay, toLocal, recognition });
  }, [clearOverlay, showBreakdown]);

  return (
    <div className="relative min-h-85 flex-1 cursor-crosshair overflow-hidden bg-surface dot-grid wide:min-h-0">
      <div ref={menuParentRef} className="absolute inset-0" />
      <div
        ref={overlayRef}
        className="recognizer-overlay pointer-events-none absolute inset-0"
      />
    </div>
  );
}
