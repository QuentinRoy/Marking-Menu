import type { Point } from '../utils.js';

const svgNamespace = 'http://www.w3.org/2000/svg';
const pathPointLimit = 100;

export type StrokeSurfaceOptions = {
  parent: HTMLElement | ShadowRoot;
  doc?: Document;
  lineWidth?: number;
  lineColor?: string;
  pointRadius?: number;
  pointColor?: string;
  parts?: readonly string[];
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
  doc = document,
  lineWidth = 2,
  lineColor = 'black',
  pointRadius = 0,
  pointColor = lineColor,
  parts = [],
}: StrokeSurfaceOptions): StrokeSurface {
  const svg = doc.createElementNS(svgNamespace, 'svg');
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
  let livePath: SVGPathElement | null = null;
  let livePathNewPointCount = 0;
  let marker: SVGCircleElement | null = null;

  const createPath = (points: Point[], newPointCount: number) => {
    const path = doc.createElementNS(svgNamespace, 'path');
    path.setAttribute('d', pathData(points));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', lineColor);
    path.setAttribute('stroke-width', String(lineWidth));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('part', ['stroke', ...parts].join(' '));

    if (marker === null) {
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

      if (livePath === null) {
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
    livePath = null;
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
    marker ??= doc.createElementNS(svgNamespace, 'circle');
    marker.setAttribute('cx', String(x));
    marker.setAttribute('cy', String(y));
    marker.setAttribute('r', String(pointRadius));
    marker.setAttribute('fill', pointColor);
    marker.setAttribute('part', ['stroke', ...parts].join(' '));
    svg.append(marker);
  };

  const clear = (): void => {
    svg.replaceChildren();
    previousStroke = [];
    pathPoints = [];
    livePath = null;
    livePathNewPointCount = 0;
    marker = null;
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
