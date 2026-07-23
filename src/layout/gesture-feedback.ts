import type { Point } from '../types.js';
import createStrokeCanvas, {
  type StrokeCanvas,
  type StrokeCanvasOptions,
} from './stroke.js';

/**
 Stroke canvas options of the gesture feedback (the parent is provided by the
 gesture feedback itself).
 */
export type GestureFeedbackStrokeOptions = Omit<StrokeCanvasOptions, 'parent'>;

/**
 The gesture feedback controls.
 */
export type GestureFeedback = {
  /** Show the feedback for the given stroke. */
  show: (stroke: readonly Point[], options?: { canceled?: boolean }) => void;
  /** Immediately remove any shown feedback. */
  remove: () => void;
};

type StrokeTimeoutEntry = {
  canvas: StrokeCanvas;
  timeout: ReturnType<typeof setTimeout>;
};

export default function createGestureFeedback({
  parent: parentDOM,
  duration,
  strokeOptions = {},
  canceledStrokeOptions = {},
}: {
  /** The parent node. */
  parent: HTMLElement;
  /** The duration of the feedback, in milliseconds. */
  duration: number;
  /** The options of the feedback strokes. */
  strokeOptions?: GestureFeedbackStrokeOptions;
  /** The options of the canceled feedback strokes. */
  canceledStrokeOptions?: GestureFeedbackStrokeOptions;
}): GestureFeedback {
  let strokeTimeoutEntries: StrokeTimeoutEntry[] = [];

  const show = (
    stroke: readonly Point[],
    { canceled = false }: { canceled?: boolean } = {},
  ) => {
    const canvas = createStrokeCanvas({
      parent: parentDOM,
      ...strokeOptions,
      ...(canceled && canceledStrokeOptions),
    });
    canvas.drawStroke(stroke);
    const timeoutEntry: StrokeTimeoutEntry = {
      canvas,
      timeout: setTimeout(() => {
        // Remove the entry from the strokeTimeoutEntries.
        strokeTimeoutEntries = strokeTimeoutEntries.filter(
          (x) => x !== timeoutEntry,
        );
        // Clear the stroke canvas.
        canvas.remove();
      }, duration),
    };
    strokeTimeoutEntries.push(timeoutEntry);
  };

  const remove = () => {
    for (const { timeout, canvas } of strokeTimeoutEntries) {
      clearTimeout(timeout);
      canvas.remove();
    }

    strokeTimeoutEntries = [];
  };

  return { show, remove };
}
