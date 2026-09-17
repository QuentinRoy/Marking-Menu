import type { Point } from '../utils.js';

const svgNamespace = 'http://www.w3.org/2000/svg';
const pathPointLimit = 100;

export type StrokeSurfaceOptions = {
  parent: HTMLElement | ShadowRoot;
  doc?: Document;
  /**
  Extra class(es) on the surface's root, for a themed variant (see
  `.marking-menu-stroke--lower` and `.marking-menu-stroke--feedback` in
  menu.css). Unset for the default (upper-stroke) styling.
  */
  className?: string;
  /**
  Paint overrides for a surface drawn outside menu.css's reach, such as the
  demo playground's recognizer overlay. Left unset, the path and point take
  their stroke/fill/width from menu.css.
  */
  lineWidth?: number;
  lineColor?: string;
  pointRadius?: number;
  pointColor?: string;
};

export type StrokeSurface = {
  element: SVGSVGElement;
  clear: () => void;
  drawStroke: (stroke: readonly Point[]) => void;
  drawPoint: (point: Point) => void;
  remove: () => void;
};

const pathData = (points: readonly Point[]): string => {
  const [first] = points;
  if (first === undefined) {
    return '';
  }

  const rest = points.length === 1 ? [first] : points.slice(1);
  return `M ${first[0]} ${first[1]} ${rest
    .map(([x, y]) => `L ${x} ${y}`)
    .join(' ')}`;
};

export function createStrokeSurface({
  parent,
  doc = parent.ownerDocument,
  className,
  lineWidth,
  lineColor,
  pointRadius,
  pointColor = lineColor,
}: StrokeSurfaceOptions): StrokeSurface {
  const svg = doc.createElementNS(svgNamespace, 'svg');
  svg.ariaHidden = 'true';
  svg.setAttribute(
    'class',
    className === undefined
      ? 'marking-menu-stroke-surface'
      : `marking-menu-stroke-surface ${className}`,
  );

  Object.assign(svg.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    overflow: 'visible',
    pointerEvents: 'none',
  });
  parent.append(svg);

  let previousStroke: readonly Point[] = [];
  let pathPoints: Point[] = [];
  let livePath: SVGPathElement | undefined;
  let livePathNewPointCount = 0;
  let marker: SVGCircleElement | undefined;

  const createPath = (points: Point[], newPointCount: number) => {
    const path = doc.createElementNS(svgNamespace, 'path');
    path.setAttribute('class', 'marking-menu-stroke-path');
    path.setAttribute('d', pathData(points));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    if (lineColor !== undefined) {
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', lineColor);
    }

    if (lineWidth !== undefined) {
      path.setAttribute('stroke-width', String(lineWidth));
    }

    if (marker === undefined) {
      svg.append(path);
    } else {
      marker.before(path);
    }

    livePath = path;
    pathPoints = points;
    livePathNewPointCount = newPointCount;
  };

  const appendPoints = (stroke: readonly Point[], from: number) => {
    for (let index = from; index < stroke.length; index++) {
      const point = stroke[index];
      if (point === undefined) {
        continue;
      }

      if (livePath === undefined) {
        createPath([point], 1);
      } else if (livePathNewPointCount === pathPointLimit) {
        const previousPoint = stroke[index - 1];
        if (previousPoint !== undefined) {
          createPath([previousPoint, point], 1);
        }
      } else {
        pathPoints.push(point);
        livePathNewPointCount++;
        livePath.setAttribute('d', pathData(pathPoints));
      }
    }
  };

  const clearPaths = () => {
    for (const path of svg.querySelectorAll('path')) {
      path.remove();
    }

    previousStroke = [];
    pathPoints = [];
    livePath = undefined;
    livePathNewPointCount = 0;
  };

  const drawStroke = (stroke: readonly Point[]): void => {
    const previousLast = previousStroke.at(-1);
    const appendBoundary = stroke[previousStroke.length - 1];
    const isAppend =
      stroke.length > previousStroke.length &&
      (previousStroke.length === 0 ||
        (previousLast !== undefined &&
          appendBoundary?.[0] === previousLast[0] &&
          appendBoundary[1] === previousLast[1]));
    const from = isAppend ? previousStroke.length : 0;
    if (!isAppend) {
      clearPaths();
    }

    appendPoints(stroke, from);
    previousStroke = stroke;
  };

  const drawPoint = ([x, y]: Point): void => {
    if (marker === undefined) {
      marker = doc.createElementNS(svgNamespace, 'circle');
      marker.setAttribute('class', 'marking-menu-stroke-point');
      if (pointRadius !== undefined) {
        marker.setAttribute('r', String(pointRadius));
      }

      if (pointColor !== undefined) {
        marker.setAttribute('fill', pointColor);
      }

      svg.append(marker);
    }

    marker.setAttribute('cx', String(x));
    marker.setAttribute('cy', String(y));
  };

  const clear = (): void => {
    svg.replaceChildren();
    previousStroke = [];
    pathPoints = [];
    livePath = undefined;
    livePathNewPointCount = 0;
    marker = undefined;
  };

  return {
    element: svg,
    clear,
    drawStroke,
    drawPoint,
    remove() {
      svg.remove();
    },
  };
}
