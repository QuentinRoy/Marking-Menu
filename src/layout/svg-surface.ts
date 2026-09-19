const svgNamespace = 'http://www.w3.org/2000/svg';

/**
  Create a full-size SVG surface inside `slot`, shared by `stroke.ts` and
  `indicator.ts`. Positioning comes from the stylesheet
  (`.marking-menu-stroke-surface`, `.marking-menu-indicator-surface`); anything
  mounting a surface outside its reach must position the surface itself.
  */
export function createFullSizeSvg(
  doc: Document,
  slot: HTMLElement | ShadowRoot,
  className: string,
): SVGSVGElement {
  const svg = doc.createElementNS(svgNamespace, 'svg');
  svg.ariaHidden = 'true';
  svg.setAttribute('class', className);
  slot.append(svg);
  return svg;
}
