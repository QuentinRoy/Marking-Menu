import type { Point } from '../utils.js';
import { createStrokeSurface } from './stroke.js';

const points = (length: number): Point[] =>
  Array.from({ length }, (_, index) => [index, index % 2]);

describe('stroke surface', () => {
  it('keeps completed chunks unchanged as a stroke grows', () => {
    const parent = document.createElement('div');
    const surface = createStrokeSurface({ parent, doc: document });

    surface.drawStroke(points(101));
    const [completed, live] = surface.element.querySelectorAll('path');
    expect(completed).toBeDefined();
    expect(live?.getAttribute('d')).toBe('M 99 1 L 100 0');
    const completedPath = completed?.getAttribute('d');

    surface.drawStroke(points(102));

    const paths = surface.element.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths[0]).toBe(completed);
    expect(paths[0]?.getAttribute('d')).toBe(completedPath);
    expect(paths[1]?.getAttribute('d')).toBe('M 99 1 L 100 0 L 101 1');
  });

  it('rebuilds when the endpoint changes without an append', () => {
    const parent = document.createElement('div');
    const surface = createStrokeSurface({ parent, doc: document });

    surface.drawStroke([
      [0, 0],
      [1, 1],
    ]);
    const previousPath = surface.element.querySelector('path');

    surface.drawStroke([
      [0, 0],
      [2, 2],
    ]);

    expect(previousPath?.isConnected).toBe(false);
    expect(surface.element.querySelector('path')?.getAttribute('d')).toBe(
      'M 0 0 L 2 2',
    );
  });

  it('moves the same marker on repeated drawPoint calls instead of piling up circles', () => {
    const parent = document.createElement('div');
    const surface = createStrokeSurface({ parent, doc: document });

    surface.drawPoint([0, 0]);
    surface.drawPoint([1, 1]);
    surface.drawPoint([2, 2]);

    const markers = surface.element.querySelectorAll(
      '.marking-menu-stroke-point',
    );
    expect(markers).toHaveLength(1);
    expect(markers[0]?.getAttribute('cx')).toBe('2');
    expect(markers[0]?.getAttribute('cy')).toBe('2');
  });
});
