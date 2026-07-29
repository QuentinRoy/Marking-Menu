import {
  fakeTimers,
  queryCanvasContext,
  stubbedCanvasContexts,
} from '../__fixtures__/canvas.js';
import type { Point } from '../utils.js';
import { createRenderer } from './renderer.js';

describe('createRenderer', () => {
  it('skips the redraw when the upper stroke is reference-equal to the previous frame', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();

    const parent = document.createElement('div');
    const renderer = createRenderer({ parent });
    const stroke: Point[] = [
      [0, 0],
      [10, 0],
    ];

    renderer.render({
      cursor: 'crosshair',
      menu: null,
      upperStroke: stroke,
      lowerStroke: null,
    });
    // Same array reference: the second render must skip the redraw.
    renderer.render({
      cursor: 'crosshair',
      menu: null,
      upperStroke: stroke,
      lowerStroke: null,
    });

    vi.advanceTimersToNextFrame();

    const context = queryCanvasContext(parent);
    expect(
      context.mock.methodCalls.filter((c) => c.method === 'stroke'),
    ).toHaveLength(1);
  });

  it('cancels a pending frame on dispose', () => {
    using _canvases = stubbedCanvasContexts();
    using _timers = fakeTimers();

    const parent = document.createElement('div');
    const renderer = createRenderer({ parent });
    const stroke: Point[] = [
      [0, 0],
      [10, 0],
    ];
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');

    renderer.render({
      cursor: 'crosshair',
      menu: null,
      upperStroke: stroke,
      lowerStroke: null,
    });
    renderer.dispose();

    expect(cancelSpy).toHaveBeenCalledOnce();
  });
});
