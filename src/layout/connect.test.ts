import { of, type Observable } from 'rxjs';
import { marbles } from 'rxjs-marbles';
import { type Mock } from 'vitest';
import type { Point } from '../utils.js';
import {
  connectLayout as connect,
  type LayoutNotification,
} from './connect.js';
import type { GestureFeedback } from './gesture-feedback.js';
import type { Menu } from './menu.js';
import type { StrokeCanvas } from './stroke.js';

vi.mock('./raf-throttle.js', () => ({ rafThrottle: vi.fn((f: unknown) => f) }));

type StrokeCanvasMock = StrokeCanvas & {
  name: string;
  mock: { div: HTMLDivElement; parent: HTMLElement; removed: boolean };
};

type MenuLayoutMock = Menu & {
  mock: {
    div: HTMLDivElement;
    parent: HTMLElement;
    removed: boolean;
    active: null;
  };
};

// The notifications used in these tests use placeholder tokens (e.g. string
// positions and menus) that stand in for the real values and are only compared
// structurally at runtime.
type Notification = LayoutNotification<string>;

// Mock values.
let upperStrokeCanvas: Mock<(parent: HTMLElement) => StrokeCanvas>;
let lowerStrokeCanvas: Mock<(parent: HTMLElement) => StrokeCanvas>;
let gestureFeedback: Mock<
  (options: { parent: HTMLElement }) => GestureFeedback
>;
let strokeCanvasInstances: StrokeCanvasMock[];
let menuLayout: Mock<
  (parent: HTMLElement, model: string, center: Point, active?: unknown) => Menu
>;
let menuLayoutInstances: MenuLayoutMock[];
let parentElement: HTMLDivElement;
let log: { error: Mock };

beforeEach(() => {
  parentElement = document.createElement('div');

  strokeCanvasInstances = [];
  const createStrokeCanvasFactory = (
    name: string,
  ): Mock<(parent: HTMLElement) => StrokeCanvas> =>
    vi.fn((parent: HTMLElement): StrokeCanvas => {
      const div = document.createElement('div');
      div.className = `${name}-stroke-canvas`;
      parent.append(div);

      // Set up the strokes properties as data attributes.
      div.dataset.points = JSON.stringify([]);
      div.dataset.stroke = null as unknown as string;

      const self: StrokeCanvasMock = {
        name,
        mock: { div, parent, removed: false },
        drawStroke: vi.fn((stroke: readonly Point[]) => {
          div.dataset.stroke = JSON.stringify(stroke);
        }),
        drawPoint: vi.fn((p: Point) => {
          const points = JSON.parse(div.dataset.points as string) as Point[];
          div.dataset.points = JSON.stringify([...points, p]);
        }),
        clear: vi.fn(() => {
          div.dataset.stroke = null as unknown as string;
          div.dataset.points = JSON.stringify([]);
        }),
        remove: vi.fn(() => {
          div.remove();
          self.mock.removed = true;
        }),
      };
      strokeCanvasInstances.push(self);
      return self;
    });
  upperStrokeCanvas = createStrokeCanvasFactory('upper');
  lowerStrokeCanvas = createStrokeCanvasFactory('lower');

  gestureFeedback = vi.fn(
    ({ parent }: { parent: HTMLElement }): GestureFeedback => {
      let divs: HTMLElement[] = [];
      const show = (stroke: readonly Point[]) => {
        const div = document.createElement('div');
        div.className = `mock-gesture-feedback`;
        parent.append(div);
        div.dataset.stroke = JSON.stringify(stroke);
      };

      const remove = () => {
        for (const d of divs) {
          d.remove();
        }

        divs = [];
      };

      return { show, remove };
    },
  );

  menuLayoutInstances = [];
  menuLayout = vi.fn(
    (
      parent: HTMLElement,
      model: string,
      center: Point,
      active?: unknown,
    ): Menu => {
      const div = document.createElement('div');
      div.className = 'menu';
      parent.append(div);

      // Set up the menu properties as data attributes.
      div.dataset.model = JSON.stringify(model);
      div.dataset.center = JSON.stringify(center);
      div.dataset.active = JSON.stringify(active);

      const self: MenuLayoutMock = {
        mock: { div, parent, removed: false, active: null },
        setActive: vi.fn((newActive: string | number | null) => {
          div.dataset.active = JSON.stringify(newActive);
        }),
        remove: vi.fn(() => {
          div.remove();
          self.mock.removed = true;
        }),
      };
      menuLayoutInstances.push(self);
      return self;
    },
  );

  log = {
    error: vi.fn(),
  };
});

describe('connect', () => {
  it('ignores move and draw notifications before the first start', () => {
    const src = of(
      { type: 'move', position: [100, 200] },
      {
        type: 'draw',
        stroke: [
          [0, 0],
          [1, 1],
        ],
      },
    ) as unknown as Observable<Notification>;

    const out = connect<string, Notification>({
      parent: parentElement,
      navigation$: src,
      createMenuLayout: menuLayout,
      createUpperStrokeCanvas: upperStrokeCanvas,
      createLowerStrokeCanvas: lowerStrokeCanvas,
      createGestureFeedback: gestureFeedback,
      log,
    });
    out.subscribe();
    expect(upperStrokeCanvas).not.toHaveBeenCalled();
    expect(lowerStrokeCanvas).not.toHaveBeenCalled();
    expect(menuLayout).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it('draws expert strokes on draw notifications', () => {
    const src = of(
      { type: 'start', position: 'pos1' },
      { type: 'draw', stroke: ['stroke1'] },
      { type: 'draw', stroke: ['stroke2'] },
      { type: 'select' },
      { type: 'start', position: 'pos2' },
      { type: 'draw', stroke: ['stroke3'] },
      { type: 'cancel' },
      { type: 'start', position: 'pos3' },
    ) as unknown as Observable<Notification>;

    const out = connect<string, Notification>({
      parent: parentElement,
      navigation$: src,
      createMenuLayout: menuLayout,
      createUpperStrokeCanvas: upperStrokeCanvas,
      createLowerStrokeCanvas: lowerStrokeCanvas,
      createGestureFeedback: gestureFeedback,
      log,
    });
    out.subscribe({
      next() {
        expect(parentElement).toMatchSnapshot();
      },
      complete() {
        expect(parentElement).toMatchSnapshot();
      },
    });
  });

  it('opens the menu, draws novice stroke, and updates the menu', () => {
    parentElement.getBoundingClientRect = vi.fn(
      () => ({ left: 1, top: 2 }) as unknown as DOMRect,
    );
    const src = of(
      { type: 'start', position: 'pos1' },
      {
        type: 'draw',
        stroke: [
          [0, 0],
          [1, 1],
        ],
      },
      { type: 'open', menu: 'menu1', center: [10, 20], position: [100, 200] },
      { type: 'move', position: [1000, 2000] },
      { type: 'change', active: { key: 'active-item-1' } },
      { type: 'move', position: [500, 700] },
      { type: 'move', position: [100, 200] },
      { type: 'change', active: undefined },
      { type: 'change', active: { key: 'active-item-2' } },
      { type: 'select' },

      { type: 'start', position: 'pos2' },
      {
        type: 'draw',
        stroke: [
          [1, 1],
          [0, 0],
        ],
      },
      { type: 'open', menu: 'menu2', center: [30, 40], position: [300, 800] },
      { type: 'move', position: [200, 900] },
      { type: 'change', active: { key: 'active-item-3' } },
      { type: 'open', menu: 'menu3', center: [60, 70], position: [300, 800] },
      { type: 'change', active: { key: 'active-item-4' } },
      { type: 'move', position: [700, 100] },
      { type: 'cancel' },

      { type: 'start', position: 'pos3' },
      { type: 'open', menu: 'menu4', center: [90, 30], position: [102, 201] },
      { type: 'move', position: [500, 0] },
      { type: 'change', active: { key: 'active-item-5' } },
    ) as unknown as Observable<Notification>;

    const out = connect<string, Notification>({
      parent: parentElement,
      navigation$: src,
      createMenuLayout: menuLayout,
      createUpperStrokeCanvas: upperStrokeCanvas,
      createLowerStrokeCanvas: lowerStrokeCanvas,
      createGestureFeedback: gestureFeedback,
      log,
    });
    out.subscribe({
      next() {
        expect(parentElement).toMatchSnapshot();
      },
      complete() {
        expect(parentElement).toMatchSnapshot();
      },
    });
  });

  // prettier-ignore
  it('cleans-up on error', marbles(m => {
    const values: Record<string, Notification> = {
      s: { type: 'start', position: 'pos1' as unknown as Point },
      o: {
        type: 'open',
        menu: 'menu1',
        center: [10, 20],
        position: [100, 200]
      }
    };
    const error = new Error('Test Error');
    const obs = m.hot('---s--o--#', values, error);
    const exp = m.hot('---s--o--#', values, error);
    m.expect(
      connect<string, Notification>({
        parent: parentElement,
        navigation$: obs,
        createMenuLayout: menuLayout,
        createUpperStrokeCanvas: upperStrokeCanvas,
        createLowerStrokeCanvas: lowerStrokeCanvas,
        createGestureFeedback: gestureFeedback,
        log,
      })
    ).toBeObservable(exp);
    m.flush();
    expect(parentElement).toMatchSnapshot();
    expect(log.error.mock.calls).toEqual([[error]]);
  }));

  // prettier-ignore
  it('cleans-up and throws on unknown event type', marbles(m => {
    const values: Record<string, Notification> = {
      s: { type: 'start', position: 'pos1' as unknown as Point },
      o: {
        type: 'open',
        menu: 'menu1',
        center: [10, 20],
        position: [100, 200]
      },
      x: { type: 'unknown' } as unknown as Notification
    };
    const error = new Error('Invalid navigation notification type: unknown');
    const obs = m.hot('---s--o--x-', values);
    const exp = m.hot('---s--o--#', values, error);
    m.expect(
      connect<string, Notification>({
        parent: parentElement,
        navigation$: obs,
        createMenuLayout: menuLayout,
        createUpperStrokeCanvas: upperStrokeCanvas,
        createLowerStrokeCanvas: lowerStrokeCanvas,
        createGestureFeedback: gestureFeedback,
        log,
      })
    ).toBeObservable(exp);
    m.flush();
    expect(parentElement).toMatchSnapshot();
    expect(log.error.mock.calls).toEqual([[error]]);
  }));
});
