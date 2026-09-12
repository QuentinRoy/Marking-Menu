import { useCallback, useEffect, useRef } from 'react';
import type { MarkingMenuMode } from '../../src/events.js';
import {
  createStrokeCanvas,
  type StrokeCanvas,
  type StrokeCanvasOptions,
} from '../../src/layout/stroke.js';
import { createMarkingMenu } from '../../src/marking-menu.js';
import {
  analyzeMarkingMenuStroke,
  type MarkingMenuStrokeAnalysis,
} from '../../src/recognizer/recognize-mm-stroke.js';
import { strokeLength } from '../../src/recognizer/stroke-length.js';
import type { MarkingMenuInput } from '../../src/types.js';
import { toLocalPoint, type Point } from '../../src/utils.js';
import {
  pathOfKey,
  stepsAlong,
  type MenuModel,
  type MenuStep,
} from './menu-model.js';
import { useLatest } from './use-latest.js';

/*
 The live half of the page: the shipped marking menu, on a surface of its
 own. Dwelling, sub-menu opening, expert detection, the highlight and the
 stroke are all the library's; what this file adds is the readout, and the
 recognizer overlay drawn once the gesture is over.
 */

// A stroke shorter than this is pointer wobble between a press and a
// release, not a gesture worth reporting on.
const CLICK_MOVEMENT_PX = 8;

/**
 What a finished gesture left on screen: the path it selected, or the
 sentence saying why it selected nothing, plus what the recognizer did.
 */
export type GestureResult = {
  readonly steps: readonly MenuStep[] | null;
  readonly message: string;
  readonly metrics: string;
};

/**
The readout before any gesture, and after one too short to count.
*/
export const IDLE_RESULT: GestureResult = {
  steps: null,
  message:
    'Press and hold to open the menu, then draw to an item; or draw the mark straight away.',
  metrics: '',
};

/**
 Draw a finished gesture: the stroke as it was made and, when the overlay is
 on, the pieces the recognizer cut it into and the corners it cut them at.

 Canvases are made per draw rather than kept and cleared: `createStrokeCanvas`
 takes its size from its parent at creation, so drawing afresh is also how the
 overlay follows a resized surface.

 Colors come from the page's own custom properties, so the legend beside the
 surface cannot fall out of step with what is drawn.

 @param options - What to draw, and where.
 @param options.overlay - The layer the canvases go in.
 @param options.stroke - The gesture, in coordinates local to `overlay`.
 @param options.analysis - What the recognizer made of that gesture.
 @returns The canvases drawn, for the caller to remove.
 */
function drawGesture({
  overlay,
  stroke,
  analysis,
}: {
  overlay: HTMLElement;
  stroke: readonly Point[];
  analysis: MarkingMenuStrokeAnalysis<MenuModel>;
}): StrokeCanvas[] {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const tokenNumber = (name: string) => Number(token(name));
  const canvases: StrokeCanvas[] = [];
  const add = (options: Omit<StrokeCanvasOptions, 'parent'>) => {
    const canvas = createStrokeCanvas({ parent: overlay, ...options });
    canvases.push(canvas);
    return canvas;
  };

  // The mark as the menu drew it, dimmed so the pieces read on top of it.
  add({
    lineColor: token('--color-stroke-trace'),
    lineWidth: tokenNumber('--mm-stroke-width'),
  }).drawStroke(stroke);

  // Two canvases, used in turn, so that consecutive pieces stay told apart
  // where they meet.
  const pieces = [token('--color-mark'), token('--color-piece-alt')].map(
    (lineColor) =>
      add({ lineColor, lineWidth: tokenNumber('--stroke-piece-width') }),
  );
  for (const [index, segment] of analysis.segments.entries()) {
    pieces[index % pieces.length]?.drawStroke(segment.points);
  }

  const corners = add({
    lineColor: 'transparent',
    pointColor: token('--color-ink'),
    pointRadius: tokenNumber('--stroke-corner-radius'),
  });
  for (const point of analysis.articulationPoints) {
    corners.drawPoint(point);
  }

  return canvases;
}

/**
 Whether the library reached this outcome by recognizing the stroke.

 It does so for an expert gesture, and for a startup one that moved at all.
 It does not for a novice release, which hit-tests the item the open menu
 already had highlighted, nor for a gesture the pointer interrupted (see the
 termination actions in `src/engine/machine.ts`). Novice mode does not even
 keep the path drawn inside the open menu: what reaches termination is the
 movement made before the menu opened, then its centre and the last point.

 @param mode - The mode the gesture ended in.
 @param wasInterrupted - Whether the pointer was cancelled outright.
 @returns Whether stroke recognition decided the outcome.
 */
function didRecognize(mode: MarkingMenuMode, wasInterrupted: boolean): boolean {
  return !wasInterrupted && mode !== 'novice';
}

/**
 What settled a gesture the recognizer had no part in, for the readout.

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
  const menuParentRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const canvasesRef = useRef<StrokeCanvas[]>([]);
  const strokeRef = useRef<Point[]>([]);
  const interruptedRef = useRef(false);
  // The last stroke the recognizer actually ran on, which is the only one
  // the overlay may be redrawn from; `null` after a gesture it had no part
  // in (see {@link didRecognize}).
  const recognizedRef = useRef<readonly Point[] | null>(null);
  const latestRef = useLatest({ model, showBreakdown, onResult });

  const clearOverlay = useCallback(() => {
    for (const canvas of canvasesRef.current) {
      canvas.remove();
    }

    canvasesRef.current = [];
  }, []);

  useEffect(() => {
    const draw = (
      stroke: readonly Point[],
      analysis: MarkingMenuStrokeAnalysis<MenuModel>,
    ) => {
      const overlay = overlayRef.current;
      if (overlay !== null) {
        canvasesRef.current = drawGesture({ overlay, stroke, analysis });
      }
    };

    const menuParent = menuParentRef.current;
    if (menuParent === null) {
      return;
    }

    const local = (position: Point): Point =>
      toLocalPoint(position, menuParent.getBoundingClientRect());

    const finish = (
      position: Point,
      mode: MarkingMenuMode,
      outcome: { steps: readonly MenuStep[] | null; message: string },
    ) => {
      const { model: current, onResult: report } = latestRef.current;
      const stroke = [...strokeRef.current, local(position)];
      strokeRef.current = stroke;
      clearOverlay();
      if (strokeLength(stroke) < CLICK_MOVEMENT_PX) {
        report(IDLE_RESULT);
        return;
      }

      const depth = outcome.steps?.length ?? 0;
      const wasInterrupted = interruptedRef.current;
      recognizedRef.current = null;
      if (!didRecognize(mode, wasInterrupted)) {
        // Nothing is drawn and no piece, corner or threshold is quoted: the
        // overlay is a picture of a recognition that did not happen, and the
        // stroke it would be drawn from is not one the library kept.
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

      recognizedRef.current = stroke;
      const analysis = analyzeMarkingMenuStroke(stroke, current);
      if (showBreakdown) {
        draw(stroke, analysis);
      }

      report({
        ...outcome,
        metrics: [
          mode,
          `depth ${depth}`,
          `${analysis.segments.length} piece(s)`,
          `${analysis.articulationPoints.length} corner(s)`,
          `threshold ${analysis.angleThreshold.toFixed(1)}°`,
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
      recognizedRef.current = null;
      clearOverlay();
      strokeRef.current = [local(event.position)];
      latestRef.current.onResult({
        steps: null,
        message: 'Drawing…',
        metrics: '',
      });
    });
    controller.on('move', (event) => {
      strokeRef.current.push(local(event.position));
    });
    controller.on('select', (event) => {
      const path = pathOfKey(event.selection.key);
      finish(event.position, event.mode, {
        steps: stepsAlong(latestRef.current.model, path),
        message: '',
      });
    });
    controller.on('cancel', (event) => {
      const { active } = event;
      finish(event.position, event.mode, {
        steps: null,
        message:
          active === null
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
    const overlay = overlayRef.current;
    const stroke = recognizedRef.current;
    if (overlay === null || stroke === null || stroke.length < 2) {
      return;
    }

    clearOverlay();
    if (!showBreakdown) {
      return;
    }

    canvasesRef.current = drawGesture({
      overlay,
      stroke,
      analysis: analyzeMarkingMenuStroke(stroke, model),
    });
  }, [clearOverlay, model, showBreakdown]);

  return (
    <div className="relative min-h-85 flex-1 cursor-crosshair overflow-hidden bg-surface dot-grid wide:min-h-0">
      <div ref={menuParentRef} className="absolute inset-0" />
      <div ref={overlayRef} className="pointer-events-none absolute inset-0" />
    </div>
  );
}
