import type { Point } from '../utils.js';

/**
 Configuration options of a stroke canvas.
 */
export type StrokeCanvasOptions = {
  /**
  The parent node.
  */
  parent: HTMLElement;
  /**
  The root document. Mostly useful for testing purposes.
  */
  doc?: Document;
  /**
  The width of the stroke, in pixels.
  */
  lineWidth?: number;
  /**
  CSS representation of the stroke color.
  */
  lineColor?: string;
  /**
  The radius of the point drawn at the start of the stroke.
  */
  pointRadius?: number;
  /**
  CSS representation of the start point color. Defaults to `lineColor`.
  */
  pointColor?: string;
  /**
  The size of the canvas points (px). Defaults to `1 / devicePixelRatio`.
  */
  ptSize?: number;
};

/**
 The methods of a stroke canvas.
 */
export type StrokeCanvas = {
  /**
  The canvas element, so callers can place it among its siblings.
  */
  element: HTMLCanvasElement;
  /**
  Clear the canvas.
  */
  clear: () => void;
  /**
  Render a path connecting every point of the given stroke.
  */
  drawStroke: (stroke: readonly Point[]) => void;
  /**
  Render the start-of-stroke marker at the given position.
  */
  drawPoint: (point: Point) => void;
  /**
  Destroy the canvas.
  */
  remove: () => void;
};

/**
 Create a stroke canvas.

 @param options - Configuration options.
 @param options.parent - The parent node.
 @param options.doc - The root document. Mostly useful for testing purposes.
 @param options.lineWidth - The width of the stroke, in pixels.
 @param options.lineColor - CSS representation of the stroke color.
 @param options.pointRadius - The radius of the point drawn at the start of
 the stroke.
 @param options.pointColor - CSS representation of the start point color.
 @param options.ptSize - The size of the canvas points (px).
 @returns The canvas methods.
 */
export function createStrokeCanvas({
  parent,
  doc = document,
  lineWidth = 2,
  lineColor = 'black',
  pointRadius = 0,
  pointColor = lineColor,
  ptSize = window.devicePixelRatio > 0 ? 1 / window.devicePixelRatio : 1,
}: StrokeCanvasOptions): StrokeCanvas {
  // Create the canvas.
  const { width, height } = parent.getBoundingClientRect();
  const canvas = doc.createElement('canvas');
  canvas.width = width / ptSize;
  canvas.height = height / ptSize;
  Object.assign(canvas.style, {
    position: 'absolute',
    left: 0,
    top: 0,
    width: `${width}px`,
    height: `${height}px`,
    'pointer-events': 'none',
  });
  parent.append(canvas);

  // Get the canvas' context and set it up.
  // `getContext('2d')` only returns null for invalid or already claimed
  // context identifiers, which cannot happen here. The assertion preserves
  // the original unchecked access instead of introducing a new throw path.
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  // Scale to the device pixel ratio.
  ctx.scale(1 / ptSize, 1 / ptSize);

  /**
   Render the start-of-stroke marker at the given position.

   @param point - Position of the point to draw.
   */
  const drawPoint = (point: Point): void => {
    const [x, y] = point;
    ctx.save();
    ctx.strokeStyle = 'none';
    ctx.fillStyle = pointColor;
    ctx.beginPath();
    ctx.moveTo(x + pointRadius, y);
    ctx.arc(x, y, pointRadius, 0, 360);
    ctx.fill();
    ctx.restore();
  };

  /**
   Clear the canvas.
   */
  const clear = (): void => {
    ctx.clearRect(0, 0, width, height);
  };

  /**
   Render a path connecting every point of the given stroke.

   @param stroke - The new stroke.
   */
  const drawStroke = (stroke: readonly Point[]): void => {
    ctx.save();
    ctx.fillStyle = 'none';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (const [i, point] of stroke.entries()) {
      if (i === 0) {
        ctx.moveTo(...point);
      } else {
        ctx.lineTo(...point);
      }
    }

    ctx.stroke();
    ctx.restore();
  };

  /**
   Destroy the canvas.
   */
  const remove = (): void => {
    canvas.remove();
  };

  return { element: canvas, clear, drawStroke, drawPoint, remove };
}
