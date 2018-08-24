import { of } from 'rxjs';
import { marbles } from 'rxjs-marbles';
import connect from './connect';

jest.mock('raf-throttle', () => jest.fn(f => f));

// Mock values.
let UpperStrokeCanvas;
let LowerStrokeCanvas;
let strokeCanvasInstances;
let MenuLayout;
let menuLayoutInstances;
let parentElement;
let log;

beforeEach(() => {
  parentElement = document.createElement('div');

  strokeCanvasInstances = [];
  const createStrokeCanvasFactory = name =>
    jest.fn(parent => {
      const div = document.createElement('div');
      div.className = `${name}-stroke-canvas`;
      parent.appendChild(div);

      // Set up the strokes properties as data attributes.
      div.dataset.points = JSON.stringify([]);
      div.dataset.stroke = null;

      const self = {
        name,
        mock: { div, parent, removed: false },
        drawStroke: jest.fn(stroke => {
          div.dataset.stroke = JSON.stringify(stroke);
        }),
        drawPoint: jest.fn(p => {
          div.dataset.points = JSON.stringify([
            ...JSON.parse(div.dataset.points),
            p
          ]);
        }),
        clear: jest.fn(() => {
          div.dataset.stroke = null;
          div.dataset.points = JSON.stringify([]);
        }),
        remove: jest.fn(() => {
          div.remove();
          self.mock.removed = true;
        })
      };
      strokeCanvasInstances.push(self);
      return self;
    });
  UpperStrokeCanvas = createStrokeCanvasFactory('upper');
  LowerStrokeCanvas = createStrokeCanvasFactory('lower');

  menuLayoutInstances = [];
  MenuLayout = jest.fn((parent, model, center, active) => {
    const div = document.createElement('div');
    div.className = 'menu';
    parent.appendChild(div);

    // Set up the menu properties as data attributes.
    div.dataset.model = JSON.stringify(model);
    div.dataset.center = JSON.stringify(center);
    div.dataset.active = JSON.stringify(active);

    const self = {
      mock: { div, parent, removed: false, active: null },
      setActive: jest.fn(newActive => {
        div.dataset.active = JSON.stringify(newActive);
      }),
      remove: jest.fn(() => {
        div.remove();
        self.mock.removed = true;
      })
    };
    menuLayoutInstances.push(self);
    return self;
  });

  log = {
    error: jest.fn()
  };
});

describe('connect', () => {
  it('draws expert strokes on draw notifications', done => {
    const src = of(
      { type: 'start', position: 'pos1' },
      { type: 'draw', stroke: 'stroke1' },
      { type: 'draw', stroke: 'stroke2' },
      { type: 'select' },
      { type: 'start', position: 'pos2' },
      { type: 'draw', stroke: 'stroke3' },
      { type: 'cancel' },
      { type: 'start', position: 'pos3' }
    );

    const out = connect(
      parentElement,
      src,
      MenuLayout,
      UpperStrokeCanvas,
      LowerStrokeCanvas
    );
    out.subscribe({
      next() {
        expect(parentElement).toMatchSnapshot();
      },
      complete() {
        expect(parentElement).toMatchSnapshot();
        done();
      }
    });
  });

  it('opens the menu, draws novice stroke, and updates the menu', done => {
    parentElement.getBoundingClientRect = jest.fn(() => ({ left: 1, top: 2 }));
    const src = of(
      { type: 'start', position: 'pos1' },
      { type: 'draw', stroke: [[0, 0], [1, 1]] },
      { type: 'open', menu: 'menu1', center: [10, 20], position: [100, 200] },
      { type: 'move', position: [1000, 2000] },
      { type: 'change', active: { id: 'active-item-1' } },
      { type: 'move', position: [500, 700] },
      { type: 'move', position: [100, 200] },
      { type: 'change', active: undefined },
      { type: 'change', active: { id: 'active-item-2' } },
      { type: 'select' },

      { type: 'start', position: 'pos2' },
      { type: 'draw', stroke: [[1, 1], [0, 0]] },
      { type: 'open', menu: 'menu2', center: [30, 40], position: [300, 800] },
      { type: 'move', position: [200, 900] },
      { type: 'change', active: { id: 'active-item-3' } },
      { type: 'open', menu: 'menu3', center: [60, 70], position: [300, 800] },
      { type: 'change', active: { id: 'active-item-4' } },
      { type: 'move', position: [700, 100] },
      { type: 'cancel' },

      { type: 'start', position: 'pos3' },
      { type: 'open', menu: 'menu4', center: [90, 30], position: [102, 201] },
      { type: 'move', position: [500, 0] },
      { type: 'change', active: { id: 'active-item-5' } }
    );

    const out = connect(
      parentElement,
      src,
      MenuLayout,
      UpperStrokeCanvas,
      LowerStrokeCanvas
    );
    out.subscribe({
      next() {
        expect(parentElement).toMatchSnapshot();
      },
      complete() {
        expect(parentElement).toMatchSnapshot();
        done();
      }
    });
  });

  // prettier-ignore
  it('cleans-up on error', marbles(m => {
    const values = {
      s: { type: 'start', position: 'pos1' },
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
      connect(
        parentElement,
        obs,
        MenuLayout,
        UpperStrokeCanvas,
        LowerStrokeCanvas,
        log
      )
    ).toBeObservable(exp);
    m.flush();
    expect(parentElement).toMatchSnapshot();
    expect(log.error.mock.calls).toEqual([[error]]);
  }));

  // prettier-ignore
  it('cleans-up and throws on unknown event type', marbles(m => {
    const values = {
      s: { type: 'start', position: 'pos1' },
      o: {
        type: 'open',
        menu: 'menu1',
        center: [10, 20],
        position: [100, 200]
      },
      x: { type: 'unknown' }
    };
    const error = new Error('Invalid navigation notification type: unknown');
    const obs = m.hot('---s--o--x-', values);
    const exp = m.hot('---s--o--#', values, error);
    m.expect(
      connect(
        parentElement,
        obs,
        MenuLayout,
        UpperStrokeCanvas,
        LowerStrokeCanvas,
        log
      )
    ).toBeObservable(exp);
    m.flush();
    expect(parentElement).toMatchSnapshot();
    expect(log.error.mock.calls).toEqual([[error]]);
  }));
});
