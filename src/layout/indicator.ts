import { degreesToRadians, type Point } from '../utils.js';

const svgNamespace = 'http://www.w3.org/2000/svg';

export type IndicatorSurfaceOptions = {
  parent: HTMLElement | ShadowRoot;
  doc?: Document;
  radius?: number;
  fillColor?: string;
  backgroundColor?: string;
};

export type IndicatorSurface = {
  element: SVGSVGElement;
  /**
   Draw the background circle and the pie sector at `center`, the sector
   sweeping `sweepDeg` clockwise from `startAngleDeg` (this codebase's angle
   convention: 0° = right, increasing clockwise on screen).
   */
  draw: (center: Point, startAngleDeg: number, sweepDeg: number) => void;
  remove: () => void;
};

export function createIndicatorSurface({
  parent,
  doc = document,
  radius = 8,
  fillColor = 'black',
  backgroundColor = 'black',
}: IndicatorSurfaceOptions): IndicatorSurface {
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

  const background = doc.createElementNS(svgNamespace, 'circle');
  background.setAttribute('class', 'marking-menu-indicator-background');
  background.setAttribute('r', String(radius));
  background.setAttribute('fill', backgroundColor);
  svg.append(background);

  const pie = doc.createElementNS(svgNamespace, 'path');
  pie.setAttribute('class', 'marking-menu-indicator-pie');
  pie.setAttribute('fill', fillColor);
  svg.append(pie);

  const draw = (
    [cx, cy]: Point,
    startAngleDeg: number,
    sweepDeg: number,
  ): void => {
    background.setAttribute('cx', String(cx));
    background.setAttribute('cy', String(cy));

    // A single SVG arc command can't sweep a full circle: its start and end
    // points would coincide and the arc degenerates. The sweep never
    // actually needs to reach 360 here -- the dwell timer driving it fires
    // on the same clock this progress is computed from, and the real
    // caller swaps this shape out for the novice-mode dot at or before
    // that moment.
    const sweep = Math.max(0, Math.min(sweepDeg, 359.9));
    const startRad = degreesToRadians(startAngleDeg);
    const endRad = degreesToRadians(startAngleDeg + sweep);
    const start: Point = [
      cx + radius * Math.cos(startRad),
      cy + radius * Math.sin(startRad),
    ];
    const end: Point = [
      cx + radius * Math.cos(endRad),
      cy + radius * Math.sin(endRad),
    ];
    const largeArcFlag = Number(sweep > 180);
    pie.setAttribute(
      'd',
      `M ${cx} ${cy} L ${start[0]} ${start[1]} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end[0]} ${end[1]} Z`,
    );
  };

  return {
    element: svg,
    draw,
    remove() {
      svg.remove();
    },
  };
}
