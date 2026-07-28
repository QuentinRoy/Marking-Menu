import type { Point } from '../utils.js';
import { createRenderer } from './renderer.js';

/*
 JSDOM has no real canvas 2D context; every canvas element created here gets
 a fake context that records the methods called on it, mirroring
 `src/layout/stroke.test.ts`. The `doc` alias (a narrower, non-overloaded
 signature) is that same file's way of stubbing `createElement` without
 going through its deprecated `(tag, options)` overload.
 */
const doc = document as unknown as {
  createElement: (tag: string, options?: ElementCreationOptions) => HTMLElement;
};

type MockContext = {
  mock: {
    methodCalls: Array<{ method: string | symbol; args: readonly unknown[] }>;
  };
};

const createMockContext = (): MockContext => {
  const target: MockContext = { mock: { methodCalls: [] } };
  return new Proxy(target, {
    get(t, name) {
      return Object.hasOwn(t, name)
        ? (t as Record<string | symbol, unknown>)[name]
        : (...args: unknown[]) => {
            t.mock.methodCalls.push({ method: name, args });
          };
    },
  });
};

describe('createRenderer', () => {
  it('skips the redraw when the upper stroke is reference-equal to the previous frame', () => {
    const docCreateElement = doc.createElement.bind(document);
    doc.createElement = vi.fn(
      (tag: string, options?: ElementCreationOptions) => {
        const elt = docCreateElement(tag, options);
        if (tag === 'canvas') {
          const context = createMockContext();
          (elt as HTMLCanvasElement).getContext = (() =>
            context) as unknown as HTMLCanvasElement['getContext'];
        }

        return elt;
      },
    );

    try {
      vi.useFakeTimers();
      try {
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

        const context = (
          parent.querySelector('canvas')
            ?.getContext as unknown as () => MockContext
        )();
        expect(
          context.mock.methodCalls.filter((c) => c.method === 'stroke'),
        ).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    } finally {
      doc.createElement = docCreateElement;
    }
  });
});
