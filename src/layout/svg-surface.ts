const svgNamespace = 'http://www.w3.org/2000/svg';

/**
  Create a full-size SVG surface inside `slot`, shared by `stroke.ts` and
  `indicator.ts`: absolute, covering its parent, with visible overflow so
  strokes can paint past the parent's box, and never intercepting pointer
  input.
  */
export function createFullSizeSvg(
  doc: Document,
  slot: HTMLElement | ShadowRoot,
  className: string,
): SVGSVGElement {
  const svg = doc.createElementNS(svgNamespace, 'svg');
  svg.ariaHidden = 'true';
  svg.setAttribute('class', className);
  Object.assign(svg.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    overflow: 'visible',
    pointerEvents: 'none',
  });
  slot.append(svg);
  return svg;
}
