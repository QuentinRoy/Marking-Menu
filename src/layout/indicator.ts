import type { Point } from '../utils.js';

const svgNamespace = 'http://www.w3.org/2000/svg';

export type IndicatorSurfaceOptions = {
  parent: HTMLElement | ShadowRoot;
  doc?: Document;
  radius?: number;
  // The gesture stroke's own line width: only used to size the dot's
  // starting radius, not the background circle.
  strokeWidth?: number;
  fillColor?: string;
  backgroundColor?: string;
};

export type IndicatorSurface = {
  // Two separate SVGs, not one: the background sits behind the gesture's
  // own stroke, the dot in front of it, so the renderer can place each on
  // its own side of that layer.
  backgroundElement: SVGSVGElement;
  dotElement: SVGSVGElement;
  /**
   Draw the target: a fixed-radius filled background at `center`, and a dot
   growing from the stroke's own half-width (so it starts looking like the
   stroke's end cap, since the cursor is hidden while this is shown) up to
   that same radius as `progress` goes from 0 to 1.
   */
  draw: (center: Point, progress: number) => void;
  remove: () => void;
};

function createSurface(doc: Document, parent: HTMLElement | ShadowRoot) {
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
  return svg;
}

export function createIndicatorSurface({
  parent,
  doc = document,
  radius = 8,
  strokeWidth = 4,
  fillColor = 'black',
  backgroundColor = 'black',
}: IndicatorSurfaceOptions): IndicatorSurface {
  const backgroundSvg = createSurface(doc, parent);
  const dotSvg = createSurface(doc, parent);

  // The background: a constant-size filled circle the dot grows to fill.
  const background = doc.createElementNS(svgNamespace, 'circle');
  background.setAttribute('class', 'marking-menu-indicator-background');
  background.setAttribute('r', String(radius));
  background.setAttribute('fill', backgroundColor);
  backgroundSvg.append(background);

  const dot = doc.createElementNS(svgNamespace, 'circle');
  dot.setAttribute('class', 'marking-menu-indicator-dot');
  dot.setAttribute('fill', fillColor);
  dotSvg.append(dot);

  const minRadius = strokeWidth / 2;
  const draw = ([cx, cy]: Point, progress: number): void => {
    background.setAttribute('cx', String(cx));
    background.setAttribute('cy', String(cy));
    dot.setAttribute('cx', String(cx));
    dot.setAttribute('cy', String(cy));
    const clamped = Math.max(0, Math.min(1, progress));
    dot.setAttribute('r', String(minRadius + (radius - minRadius) * clamped));
  };

  return {
    backgroundElement: backgroundSvg,
    dotElement: dotSvg,
    draw,
    remove() {
      backgroundSvg.remove();
      dotSvg.remove();
    },
  };
}
