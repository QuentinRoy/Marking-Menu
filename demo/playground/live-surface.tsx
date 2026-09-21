import { useCallback, useEffect, useRef } from 'react';
import { createMarkingMenu } from '../../src/create-marking-menu.js';
import type {
  MarkingMenuMode,
  MarkingMenuRecognition,
} from '../../src/events.js';
import type { MarkingMenuInput } from '../../src/types.js';
import type { Point } from '../../src/utils.js';
import {
  pathOfNode,
  stepsAlong,
  type MenuModel,
  type MenuStep,
} from './menu-model.js';
import { useLatest } from './use-latest.js';

/*
 The live half of the page: the shipped marking menu. Dwelling, sub-menu
 opening, expert detection and the stroke are the library's; this file adds
 the readout and draws the recognizer overlay from `select` and `cancel`'s
 `event.recognition`.
 */

const svgNamespace = 'http://www.w3.org/2000/svg';

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
 The length of a pointer path.

 @param points - An ordered list of points.
 @returns The summed distance between consecutive points.
 */
function pathLength(points: readonly Point[]): number {
  let length = 0;
  let previous: Point | undefined;
  for (const point of points) {
    if (previous !== undefined) {
      length += Math.hypot(point[0] - previous[0], point[1] - previous[1]);
    }

    previous = point;
  }

  return length;
}

/**
 An SVG path's `d` attribute tracing straight segments through `points`.

 @param points - The points to connect, in order.
 @returns The path data, or `''` for no points.
 */
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
 Draw a gesture's recognizer breakdown: the stroke, its pieces, and the
 corners between them.

 Colors and weights come from `styles.css`, so the legend beside the surface
 can't drift from what's drawn. `recognition`'s points are in client
 coordinates, so each is offset against `overlay`'s own box first.

 @param overlay - Where to draw the breakdown.
 @param recognition - What the recognizer made of the gesture.
 */
function drawRecognition(
  overlay: HTMLElement,
  recognition: MarkingMenuRecognition,
): void {
  const rect = overlay.getBoundingClientRect();
  const toLocal = ([x, y]: Point): Point => [x - rect.left, y - rect.top];

  const svg = document.createElementNS(svgNamespace, 'svg');
  svg.setAttribute('aria-hidden', 'true');

  const group = (className: string) => {
    const g = document.createElementNS(svgNamespace, 'g');
    g.setAttribute('class', className);
    svg.append(g);
    return g;
  };

  const path = (parent: Element, points: readonly Point[]) => {
    const element = document.createElementNS(svgNamespace, 'path');
    element.setAttribute('d', pathData(points.map((point) => toLocal(point))));
    parent.append(element);
    return element;
  };

  path(svg, recognition.stroke).setAttribute('class', 'trace');

  const pieces = group('pieces');
  for (const segment of recognition.analysis.segments) {
    path(pieces, segment.points);
  }

  // A fresh circle per corner, unlike the library's shared marker, so every
  // corner stays visible.
  const corners = group('corners');
  for (const point of recognition.analysis.articulationPoints) {
    const [x, y] = toLocal(point);
    const circle = document.createElementNS(svgNamespace, 'circle');
    circle.setAttribute('cx', String(x));
    circle.setAttribute('cy', String(y));
    corners.append(circle);
  }

  overlay.append(svg);
}

/**
 What settled a gesture the recognizer had no part in, for the readout.

 @param mode - The mode the gesture ended in.
 @param wasInterrupted - Whether the pointer was canceled.
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
  model,
  showBreakdown,
  onResult,
}: {
  menu: MarkingMenuInput;
  model: MenuModel;
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
  const strokeRef = useRef<Point[]>([]);
  // The recognition currently drawn, redrawn as-is when the breakdown is
  // toggled back on; `undefined` when the recognizer took no part.
  const lastRecognitionRef = useRef<MarkingMenuRecognition | undefined>(
    undefined,
  );
  const latestRef = useLatest({ model, showBreakdown, onResult });

  const clearOverlay = useCallback(() => {
    overlayRef.current?.replaceChildren();
  }, []);

  useEffect(() => {
    const draw = (recognition: MarkingMenuRecognition) => {
      const overlay = overlayRef.current ?? undefined;
      if (overlay !== undefined) {
        drawRecognition(overlay, recognition);
      }
    };

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
        // No recognition: nothing to draw or quote.
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
      // The playground never opens a standalone menu.
      if (event.mode === 'standalone') {
        return;
      }

      const path = pathOfNode(event.selection);
      finish(event.position, event.mode, event.recognition, {
        steps: stepsAlong(latestRef.current.model, path),
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
  }, [clearOverlay, latestRef, menu, showBreakdown]);

  // Turning the overlay off, or back on, redraws the gesture already on
  // screen rather than waiting for the next one. Only a gesture the
  // recognizer ran on has anything to redraw.
  useEffect(() => {
    const overlay = overlayRef.current ?? undefined;
    const recognition = lastRecognitionRef.current;
    if (overlay === undefined || recognition === undefined) {
      return;
    }

    clearOverlay();
    if (!showBreakdown) {
      return;
    }

    drawRecognition(overlay, recognition);
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
