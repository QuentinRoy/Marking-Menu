import { createGestureFeedback } from '../layout/gesture-feedback.js';
import { rafThrottle } from '../layout/raf-throttle.js';
import { createStrokeCanvas, type StrokeCanvas } from '../layout/stroke.js';
import type { Point } from '../utils.js';
import type { LayoutView } from './layout-view.js';

export type FeedbackEffect = {
  readonly stroke: readonly Point[];
  readonly canceled: boolean;
};

export type LayoutRenderer = {
  render: (view: LayoutView) => void;
  showFeedback: (effect: FeedbackEffect) => void;
  dispose: () => void;
};

export function createRenderer({
  parent,
}: {
  parent: HTMLElement;
}): LayoutRenderer {
  let upperStrokeCanvas: StrokeCanvas | null = null;
  // Reference-equality cache: an unchanged stroke array skips the redraw.
  let previousUpperStroke: readonly Point[] | null = null;
  // The parent's own inline cursor, read before the renderer writes one, and
  // restored rather than cleared whenever the view asks for `default`: what
  // the renderer did not set, it does not get to throw away.
  const ownCursor = parent.style.cursor;
  const gestureFeedback = createGestureFeedback({ parent, duration: 1000 });

  const drawUpperStroke = rafThrottle((stroke: readonly Point[]) => {
    upperStrokeCanvas?.clear();
    upperStrokeCanvas?.drawStroke(stroke);
  });

  return {
    render(view) {
      parent.style.cursor = view.cursor === 'default' ? ownCursor : view.cursor;

      if (view.upperStroke === null) {
        upperStrokeCanvas?.remove();
        upperStrokeCanvas = null;
        previousUpperStroke = null;
        return;
      }

      if (view.upperStroke === previousUpperStroke) {
        return;
      }

      previousUpperStroke = view.upperStroke;
      upperStrokeCanvas ??= createStrokeCanvas({ parent });
      drawUpperStroke(view.upperStroke);
    },
    showFeedback(effect) {
      gestureFeedback.show(effect.stroke, { canceled: effect.canceled });
    },
    dispose() {
      parent.style.cursor = ownCursor;
      // A frame scheduled by `drawUpperStroke` may still be pending. It is
      // inert once the canvas below is dropped (the throttled callback
      // optional-chains on it), so there is nothing to cancel here. See
      // https://github.com/QuentinRoy/Marking-Menu/issues/153 for giving
      // `rafThrottle` a real cancellation handle.
      upperStrokeCanvas?.remove();
      upperStrokeCanvas = null;
      gestureFeedback.remove();
    },
  };
}
