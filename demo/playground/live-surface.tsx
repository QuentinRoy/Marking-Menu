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
 The live half of the page: the shipped marking menu, on a surface of its
 own. Dwelling, sub-menu opening, expert detection, the highlight and the
 stroke are all the library's; what this file adds is the readout, and the
 recognizer overlay drawn from what `select` and `cancel` report back.
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

/**
 The total length of a path through `points`.

 @param points - The path, in order.
 @returns The sum of the distance between each consecutive pair.
 */
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
 Draw a finished gesture: the stroke as it was made, dimmed, and on top of
 it, the pieces the recognizer cut it into and the corners it cut them at.

 Colors come from the page's own custom properties, so the legend beside the
 surface cannot fall out of step with what is drawn.

 @param options - What to draw, and where.
 @param options.overlay - The layer the drawing goes in.
 @param options.toLocal - Converts a client-coordinate point to one local to
 `overlay`.
 @param options.recognition - What the recognizer made of the gesture.
 @returns The `<svg>` drawn, for the caller to remove.
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

  // The mark as the menu drew it, dimmed so the pieces read on top of it.
  addPath(
    recognition.stroke.map((point) => toLocal(point)),
    token('--color-stroke-trace'),
    tokenNumber('--mm-stroke-width'),
  );

  // Two colors alternate so consecutive pieces stay distinct where they
  // meet.
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
 What settled a gesture the recognizer had no part in, for the readout.

 A missing `recognition` is the only signal that the recognizer did not run:
 it does not for a novice release, which hit-tests the item the open menu
 already had highlighted, nor for a gesture the pointer interrupted outright.

 @param mode - The mode the gesture ended in.
 @param wasInterrupted - Whether the pointer was cancelled outright.
 @returns A phrase naming what decided.
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
  /**
  Whether to draw the pieces and corners the recognizer worked from.
  */
  showBreakdown: boolean;
  onResult: (result: GestureResult) => void;
}) {
  // Bound to JSX via `ref={}` below: React itself sets `.current` to `null`
  // on unmount, so these two must stay `null`-typed.
  /* eslint-disable @typescript-eslint/no-restricted-types -- DOM refs */
  const menuParentRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  /* eslint-enable @typescript-eslint/no-restricted-types -- DOM refs */
  const svgRef = useRef<SVGSVGElement | undefined>(undefined);
  const strokeRef = useRef<Point[]>([]);
  const interruptedRef = useRef(false);
  // The last recognition the overlay may be redrawn from; `undefined` after a
  // gesture the recognizer had no part in (see {@link decidedBy}).
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
        // Nothing is drawn and no piece or corner is quoted: the overlay is a
        // picture of a recognition that did not happen.
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
      // Nothing here times the menu or touches its layout: the point of this
      // page is what the shipped one looks like and does.
      //
      // With the breakdown off the page draws nothing at all, so the library
      // keeps its own completed-gesture trace and what is on screen is the
      // technique untouched. With it on, the overlay covers that same
      // stroke, so the library's copy is switched off rather than drawn
      // twice over.
      ...(showBreakdown && { gestureFeedbackDuration: 0 }),
    });

    // A gesture the pointer never finished: the library announces `cancel`
    // without recognizing anything, and the event says no more than any
    // other cancel does. Captured, so the flag is set before the library's
    // own listener runs and dispatches that event.
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
      // The playground never opens a standalone menu on this surface.
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

  // Turning the overlay off, or back on, redraws the gesture already on
  // screen rather than waiting for the next one. Only a gesture the
  // recognizer ran on has anything to redraw.
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
