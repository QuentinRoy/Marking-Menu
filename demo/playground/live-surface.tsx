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
  let previous: Point | undefined;
  for (const point of points) {
    if (previous !== undefined) {
      total += Math.hypot(point[0] - previous[0], point[1] - previous[1]);
    }

    previous = point;
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
 Draws a gesture's recognizer breakdown: the stroke, its pieces, and the
 corners between them. Colors and weights come from `styles.css`, so the
 legend beside the surface can't drift from what's drawn.
 */
function drawRecognition(
  overlay: HTMLElement,
  recognition: MarkingMenuRecognition,
): void {
  const rect = overlay.getBoundingClientRect();
  const toLocal = ([x, y]: Point): Point => [x - rect.left, y - rect.top];

  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('aria-hidden', 'true');

  const group = (className: string) => {
    const g = document.createElementNS(SVG_NAMESPACE, 'g');
    g.setAttribute('class', className);
    svg.append(g);
    return g;
  };

  const path = (parent: Element, points: readonly Point[]) => {
    const element = document.createElementNS(SVG_NAMESPACE, 'path');
    element.setAttribute(
      'd',
      pathData(points.map((point) => toLocal(point))),
    );
    parent.append(element);
  };

  path(group('trace'), recognition.stroke);

  const pieces = group('pieces');
  for (const segment of recognition.analysis.segments) {
    path(pieces, segment.points);
  }

  // A fresh circle per corner, unlike the library's shared marker, so every
  // corner stays visible.
  const corners = group('corners');
  for (const point of recognition.analysis.articulationPoints) {
    const [x, y] = toLocal(point);
    const circle = document.createElementNS(SVG_NAMESPACE, 'circle');
    circle.setAttribute('cx', String(x));
    circle.setAttribute('cy', String(y));
    corners.append(circle);
  }

  overlay.append(svg);
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
  const strokeRef = useRef<Point[]>([]);
  // Save the latest recognition so the breakdown can be toggled.
  const lastRecognitionRef = useRef<MarkingMenuRecognition | undefined>(
    undefined,
  );
  const latestRef = useLatest({ menu, showBreakdown, onResult });

  const clearOverlay = useCallback(() => {
    overlayRef.current?.replaceChildren();
  }, []);

  const draw = useCallback((recognition: MarkingMenuRecognition) => {
    const overlay = overlayRef.current ?? undefined;
    if (overlay !== undefined) {
      drawRecognition(overlay, recognition);
    }
  }, []);

  useEffect(() => {
    const menuParent = menuParentRef.current ?? undefined;
    if (menuParent === undefined) {
      return;
    }

    const finish = (
      position: Point,
      mode: MarkingMenuMode,
      recognition: MarkingMenuRecognition | undefined,
      {
        wasInterrupted = false,
        ...outcome
      }: {
        steps: readonly MenuStep[] | undefined;
        message: string;
        wasInterrupted?: boolean;
      },
    ) => {
      const { onResult: report } = latestRef.current;
      const stroke = [...strokeRef.current, position];
      strokeRef.current = stroke;
      clearOverlay();
      if (pathLength(stroke) < CLICK_MOVEMENT_PX) {
        report(IDLE_RESULT);
        return;
      }

      const depth = outcome.steps?.length ?? 0;
      lastRecognitionRef.current = recognition;
      if (recognition === undefined) {
        // No recognition, nothing to draw or quote.
        report({
          ...outcome,
          metrics: [
            mode,
            `depth ${depth}`,
            decidedBy(mode, wasInterrupted),
          ].join(' · '),
        });
        return;
      }

      if (showBreakdown) {
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

    controller.on('start', (event) => {
      lastRecognitionRef.current = undefined;
      clearOverlay();
      strokeRef.current = [event.position];
      latestRef.current.onResult({
        steps: undefined,
        message: 'Drawing…',
        metrics: '',
      });
    });
    controller.on('move', (event) => {
      strokeRef.current.push(event.position);
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
        wasInterrupted: event.reason === 'interrupted',
      });
    });

    return () => {
      controller.dispose();
      clearOverlay();
    };
  }, [clearOverlay, draw, latestRef, menu, showBreakdown]);

  // Toggling the breakdown redraws the last gesture instead of waiting for
  // the next one; only one the recognizer ran on has anything to redraw.
  useEffect(() => {
    const recognition = lastRecognitionRef.current;
    if (recognition === undefined) {
      return;
    }

    clearOverlay();
    if (showBreakdown) {
      draw(recognition);
    }
  }, [clearOverlay, draw, showBreakdown]);

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
