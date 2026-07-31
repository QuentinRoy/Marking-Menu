import {
  fakeTimers,
  queryCanvasContext,
  stubbedCanvasContexts,
} from '../__fixtures__/canvas.js';
import { createModel } from '../model.js';
import type { Point } from '../utils.js';
import { createRenderer } from './renderer.js';

const model = createModel({
  items: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
});

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

  it('updates the active item only when activeKey changes, skipping the redundant DOM scan otherwise', () => {
    using _canvases = stubbedCanvasContexts();
    const parent = document.createElement('div');
    const renderer = createRenderer<typeof model>({ parent });
    const activeCount = () =>
      parent.querySelectorAll('.marking-menu-item.active').length;

    renderer.render({
      cursor: 'none',
      menu: { model, center: [0, 0], activeKey: '0' },
      upperStroke: null,
      lowerStroke: null,
    });
    expect(activeCount()).toBe(1);
    expect(parent.querySelector('[data-item-id="0"]')?.classList).toContain(
      'active',
    );

    // Same activeKey, same menu identity: the skip branch.
    renderer.render({
      cursor: 'none',
      menu: { model, center: [0, 0], activeKey: '0' },
      upperStroke: null,
      lowerStroke: null,
    });
    expect(activeCount()).toBe(1);

    // A different activeKey: the changed branch moves the active item.
    renderer.render({
      cursor: 'none',
      menu: { model, center: [0, 0], activeKey: '1' },
      upperStroke: null,
      lowerStroke: null,
    });
    expect(activeCount()).toBe(1);
    expect(parent.querySelector('[data-item-id="1"]')?.classList).toContain(
      'active',
    );

    renderer.dispose();
  });
});
