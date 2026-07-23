import stroke from './stroke.js';

// `document.createElement`'s typings include a deprecated overload. Alias the
// document through a minimal, non-deprecated shape so overriding the method
// does not reference that overload.
const doc = document as unknown as {
  createElement: (tag: string, options?: ElementCreationOptions) => HTMLElement;
};
const docCreateElement = doc.createElement.bind(document);

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
            t.mock.methodCalls.push({
              method: name,
              args,
            });
          };
    },
  });
};

const queryCanvas = (parent: HTMLElement): HTMLCanvasElement =>
  parent.querySelector('canvas') as HTMLCanvasElement;

const getMockContext = (canvas: HTMLCanvasElement): MockContext =>
  (canvas.getContext as unknown as () => MockContext)();

describe('stroke', () => {
  let strokeCanvas: ReturnType<typeof stroke>;
  let div: HTMLDivElement;
  let mockContext: MockContext;

  beforeEach(() => {
    doc.createElement = vi.fn(
      (tag: string, options?: ElementCreationOptions): HTMLElement => {
        const elt = docCreateElement(tag, options);
        if (tag === 'canvas') {
          const context = createMockContext();
          (elt as HTMLCanvasElement).getContext = (() =>
            context) as unknown as HTMLCanvasElement['getContext'];
        }

        return elt;
      },
    );

    div = document.createElement('div');
    div.getBoundingClientRect = () =>
      ({ width: 50, height: 60 }) as unknown as DOMRect;
    strokeCanvas = stroke({
      parent: div,
      doc: document,
      ptSize: 1 / 4,
      pointRadius: 100,
      pointColor: 'mockPointColor',
      lineWidth: 7,
      lineColor: 'mockLineColor',
    });
    mockContext = getMockContext(queryCanvas(div));
  });

  afterEach(() => {
    doc.createElement = docCreateElement;
    vi.unstubAllGlobals();
  });

  it('defaults ptSize to the device pixel ratio', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const dprDiv = document.createElement('div');
    dprDiv.getBoundingClientRect = () =>
      ({ width: 50, height: 60 }) as unknown as DOMRect;
    stroke({ parent: dprDiv, doc: document });
    const canvas = queryCanvas(dprDiv);
    expect(canvas.width).toBe(100);
    expect(getMockContext(canvas).mock.methodCalls).toEqual([
      { method: 'scale', args: [2, 2] },
    ]);
  });

  it('defaults ptSize to 1 if there is no device pixel ratio', () => {
    vi.stubGlobal('devicePixelRatio', undefined);
    const noDprDiv = document.createElement('div');
    noDprDiv.getBoundingClientRect = () =>
      ({ width: 50, height: 60 }) as unknown as DOMRect;
    stroke({ parent: noDprDiv, doc: document });
    const canvas = queryCanvas(noDprDiv);
    expect(canvas.width).toBe(50);
    expect(getMockContext(canvas).mock.methodCalls).toEqual([
      { method: 'scale', args: [1, 1] },
    ]);
  });

  it('creates its DOM and set up the canvas scale', () => {
    expect(div).toMatchSnapshot();
    expect(getMockContext(queryCanvas(div)).mock.methodCalls).toEqual([
      { method: 'scale', args: [4, 4] },
    ]);
  });

  it('can be removed', () => {
    strokeCanvas.remove();
    expect(div).toMatchSnapshot();
  });

  it('can draw points', () => {
    // Clear the method calls.
    mockContext.mock.methodCalls = [];

    strokeCanvas.drawPoint([10, 12]);
    strokeCanvas.drawPoint([5.2, 0]);
    expect(mockContext.mock.methodCalls).toMatchSnapshot();
  });

  it('can draw strokes', () => {
    // Clear the method calls.
    mockContext.mock.methodCalls = [];

    strokeCanvas.drawStroke([
      [3, 2],
      [2, 4],
      [5, 1],
      [9, 0],
    ]);
    strokeCanvas.drawStroke([
      [10, 0],
      [0, 0],
      [1, 1],
      [1, 0],
    ]);
    expect(mockContext.mock.methodCalls).toMatchSnapshot();
  });

  it('can be cleared', () => {
    // Clear the method calls.
    mockContext.mock.methodCalls = [];
    strokeCanvas.clear();
    expect(mockContext.mock.methodCalls).toMatchSnapshot();
  });
});
