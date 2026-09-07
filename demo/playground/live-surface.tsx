import { useCallback, useEffect, useRef } from 'react';
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
import { useColorScheme } from './use-color-scheme.js';

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
 @param options.showDiagnostics - Whether to draw the pieces and corners too.
 @returns The canvases drawn, for the caller to remove.
 */
function drawGesture({
  overlay,
  stroke,
  analysis,
  showDiagnostics,
}: {
  overlay: HTMLElement;
  stroke: readonly Point[];
  analysis: MarkingMenuStrokeAnalysis<MenuModel>;
  showDiagnostics: boolean;
}): StrokeCanvas[] {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const canvases: StrokeCanvas[] = [];
  const add = (options: Omit<StrokeCanvasOptions, 'parent'>) => {
    const canvas = createStrokeCanvas({ parent: overlay, ...options });
    canvases.push(canvas);
    return canvas;
  };

  add({ lineColor: token('--color-stroke-trace'), lineWidth: 2 }).drawStroke(
    stroke,
  );
  if (!showDiagnostics) {
    return canvases;
  }

  // Two canvases, used in turn, so that consecutive pieces stay told apart
  // where they meet.
  const pieces = [token('--color-mark'), token('--color-piece-alt')].map(
    (lineColor) => add({ lineColor, lineWidth: 3 }),
  );
  for (const [index, segment] of analysis.segments.entries()) {
    pieces[index % pieces.length]?.drawStroke(segment.points);
  }

  const corners = add({
    lineColor: 'transparent',
    pointColor: token('--color-ink'),
    pointRadius: 4.5,
  });
  for (const point of analysis.articulationPoints) {
    corners.drawPoint(point);
  }

  return canvases;
}

export function LiveSurface({
  menu,
  model,
  showDiagnostics,
  onResult,
}: {
  menu: MarkingMenuInput;
  model: MenuModel;
  /**
  Whether to draw the pieces and corners the recognizer worked from.
  */
  showDiagnostics: boolean;
  onResult: (result: GestureResult) => void;
}) {
  const colorScheme = useColorScheme();
  const menuParentRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const canvasesRef = useRef<StrokeCanvas[]>([]);
  const strokeRef = useRef<Point[]>([]);
  // Read at event time rather than closed over, so a re-render does not tear
  // the live menu down mid-gesture.
  const latestRef = useRef({ model, showDiagnostics, onResult });
  useEffect(() => {
    latestRef.current = { model, showDiagnostics, onResult };
  });

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
        canvasesRef.current = drawGesture({
          overlay,
          stroke,
          analysis,
          showDiagnostics: latestRef.current.showDiagnostics,
        });
      }
    };

    const menuParent = menuParentRef.current;
    if (menuParent === null) {
      return;
    }

    const local = (position: Point): Point =>
      toLocalPoint(position, menuParent.getBoundingClientRect());

    const style = getComputedStyle(document.documentElement);
    const token = (name: string) => style.getPropertyValue(name).trim();

    const finish = (
      position: Point,
      mode: string,
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

      const analysis = analyzeMarkingMenuStroke(stroke, current);
      draw(stroke, analysis);
      const depth = outcome.steps?.length ?? 0;
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
      // Everything the machine is timed by stays at the library's own
      // defaults: the point of this page is what the shipped menu does.
      // The colours are options rather than CSS, so they are read from the
      // page's own tokens here, and `colorScheme` is in this effect's
      // dependencies so a change of scheme rebuilds the menu with the new
      // ones.
      strokeColor: token('--color-stroke-live'),
      strokeWidth: 2,
      strokeStartPointRadius: 6,
      lowerStrokeColor: token('--color-stroke-lower'),
      // The library removes a completed trace on a timer, one canvas per
      // gesture; the overlay below draws the same stroke and owns its own
      // canvases, so the library's copy is switched off rather than raced.
      gestureFeedbackDuration: 0,
    });

    controller.on('start', (event) => {
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
      controller.dispose();
      clearOverlay();
      strokeRef.current = [];
    };
  }, [clearOverlay, colorScheme, menu]);

  // Turning the overlay off, or back on, redraws the gesture already on
  // screen rather than waiting for the next one.
  useEffect(() => {
    const overlay = overlayRef.current;
    const stroke = strokeRef.current;
    if (overlay === null || stroke.length < 2) {
      return;
    }

    clearOverlay();
    canvasesRef.current = drawGesture({
      overlay,
      stroke,
      analysis: analyzeMarkingMenuStroke(stroke, model),
      showDiagnostics,
    });
  }, [clearOverlay, colorScheme, model, showDiagnostics]);

  return (
    <div className="bg-surface relative min-h-[340px] flex-1 cursor-crosshair overflow-hidden [background-image:radial-gradient(var(--color-dot)_1px,transparent_1px)] [background-size:22px_22px] min-[621px]:min-h-0">
      <div ref={menuParentRef} className="absolute inset-0" />
      <div ref={overlayRef} className="pointer-events-none absolute inset-0" />
    </div>
  );
}
