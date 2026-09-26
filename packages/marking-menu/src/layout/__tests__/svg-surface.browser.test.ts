import { createFullSizeSvg } from '../svg-surface.js';

describe('full-size SVG surface', () => {
  it('appends the SVG to the given slot with the given class', () => {
    const slot = document.createElement('div');
    const other = document.createElement('div');

    const svg = createFullSizeSvg(
      document,
      slot,
      'marking-menu-stroke-surface',
    );

    expect(svg.parentElement).toBe(slot);
    expect(other.children).toHaveLength(0);
    expect(svg.getAttribute('class')).toBe('marking-menu-stroke-surface');
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.ariaHidden).toBe('true');
  });

  it('leaves positioning to the stylesheet', () => {
    const slot = document.createElement('div');

    const svg = createFullSizeSvg(document, slot, 'marking-menu-test');

    expect(svg.getAttribute('style')).toBeNull();
  });
});
