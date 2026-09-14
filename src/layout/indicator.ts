import type { Point } from '../utils.js';

const svgNamespace = 'http://www.w3.org/2000/svg';

export type IndicatorSurfaceOptions = {
  parent: HTMLElement | ShadowRoot;
  doc?: Document;
  radius?: number;
  strokeWidth?: number;
  fillColor?: string;
  backgroundColor?: string;
};

export type IndicatorSurface = {
  element: SVGSVGElement;
  /**
   Draw the target: a fixed-radius outline at `center`, and a dot growing
   from the stroke's own half-width (so it starts looking like the stroke's
   end cap, since the cursor is hidden while this is shown) up to that same
   radius as `progress` goes from 0 to 1.
   */
  draw: (center: Point, progress: number) => void;
  remove: () => void;
};

export function createIndicatorSurface({
  parent,
  doc = document,
  radius = 8,
  strokeWidth = 1,
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

  // The outline: a constant-size ring the dot grows to fill.
  const outline = doc.createElementNS(svgNamespace, 'circle');
  outline.setAttribute('class', 'marking-menu-indicator-background');
  outline.setAttribute('r', String(radius));
  outline.setAttribute('fill', 'none');
  outline.setAttribute('stroke', backgroundColor);
  outline.setAttribute('stroke-width', String(strokeWidth));
  svg.append(outline);

  const dot = doc.createElementNS(svgNamespace, 'circle');
  dot.setAttribute('class', 'marking-menu-indicator-dot');
  dot.setAttribute('fill', fillColor);
  svg.append(dot);

  const minRadius = strokeWidth / 2;
  const draw = ([cx, cy]: Point, progress: number): void => {
    outline.setAttribute('cx', String(cx));
    outline.setAttribute('cy', String(cy));
    dot.setAttribute('cx', String(cx));
    dot.setAttribute('cy', String(cy));
    const clamped = Math.max(0, Math.min(1, progress));
    dot.setAttribute('r', String(minRadius + (radius - minRadius) * clamped));
  };

  return {
    element: svg,
    draw,
    remove() {
      svg.remove();
    },
  };
}
