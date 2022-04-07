import { fromEvent, merge, empty, of } from 'rxjs';
import { takeUntil, withLatestFrom } from 'rxjs/operators';
import { marbles } from 'rxjs-marbles';
import watchDrags, { mouseDrags, touchDrags } from './linear-drag';
import {
  createPEventFromTouchEvent,
  createPEventFromMouseEvent,
} from './pointer-events';

const toPromise = (obs) =>
  new Promise((resolve, reject) => {
    obs.subscribe({
      complete: resolve,
      error: reject,
    });
  });

jest.mock('./pointer-events', () => ({
  createPEventFromTouchEvent: jest.fn(() => {}),
  createPEventFromMouseEvent: jest.fn(() => {}),
}));

jest.mock('rxjs', () => ({
  ...require.requireActual('rxjs'),
  fromEvent: jest.fn(() => {}),
}));

beforeEach(() => {
  createPEventFromTouchEvent.mockImplementation((x) => x);
  createPEventFromMouseEvent.mockImplementation((x) => x);
});

afterEach(() => {
  jest.resetAllMocks();
});

const mockFromEvent = (observables) => {
  fromEvent.mockImplementation((_, evt) => observables[evt]);
};

// prettier-ignore
describe('mouseDrags', () => {
  it('properly emit drags', marbles(m => {
    const mValues = { a: 'ma', d: 'md', e: 'me', j: 'mj', k: 'mk' };
    const mousedown = m.hot('^----a--------------j----------');
    const mousemove = m.hot('^-b-c-----d-e--f-g------k---l--');
    const mouseup   = m.hot('^-h----------i------------m----');
    const moveUpSub1 =      '-----^-------!'
    const moveUpSub2 =      '--------------------^-----!'     ;
    const drags = {
      x:              m.cold(    'a----d-e|'                 , mValues),
      y:              m.cold(                   'j---k-|'    , mValues)
    };
    const expected  = m.hot('^----x--------------y----------', drags);

    mockFromEvent({ mousedown, mousemove, mouseup });
    createPEventFromMouseEvent.mockImplementation(x => `m${x}`)

    m.expect(mouseDrags('root-node')).toBeObservable(expected);
    m.expect(mousemove).toHaveSubscriptions([moveUpSub1, moveUpSub2]);
    m.expect(mouseup).toHaveSubscriptions([moveUpSub1, moveUpSub2]);
  }));

  it('calls fromEvent with the provided node', marbles(async m => {
    const mousedown = m.hot('^----a--------------j----------');
    const mousemove = m.hot('^-b-c-----d-e--f-g------k---l--');
    const mouseup   = m.hot('^-h----------i------------m----');
    const end       = m.hot('^-----------------------------x');

    mockFromEvent({ mousedown, mousemove, mouseup });

    await toPromise(mouseDrags('root-node').pipe(takeUntil(end)));
    expect(
      fromEvent.mock.calls.every(call => call[0] === 'root-node')
    ).toBe(true);
  }));

  it('subdrags are behaviors',  marbles(m => {
    const down = m.hot ('^----a--------------------------');
    const move = m.hot ('^-b-c-----d-e-f-----i----j------');
    const up   = m.hot ('^-g-------------------h---------');
    const iValues = {
      x:         m.cold(         'ad-e-f-----i-|'         ),
      y:         m.cold(                  'f-i-|'         ),
      z:         m.cold(                            '|'),
    };
    const i    = m.hot ('^--------x--------y---------z', iValues);

    mockFromEvent({ mousedown: down, mousemove: move, mouseup: up });
    m.expect(
      i.pipe(withLatestFrom(
        mouseDrags('root-node'),
        (_, d) => merge(empty(), d)
      )
    )).toBeObservable(i);
  }));
});

describe('touchDrags', () => {
  let v;
  beforeEach(() => {
    v = {
      o: { targetTouches: { length: 0 }, name: 'o' },
      a: { targetTouches: { length: 1 }, name: 'a' },
      b: { targetTouches: { length: 2 }, name: 'b' },
      c: { targetTouches: { length: 3 }, name: 'c' },
      m: { targetTouches: { length: 1 }, name: 'm' },
      i: { targetTouches: { length: 1 }, name: 'i' },
    };
  });

  // prettier-ignore
  it('properly emit drags', marbles(m => {
    createPEventFromTouchEvent.mockImplementation(x => x.name);
    const touchstart  = m.hot('^b-----a-----a---c--b----a-----------------', v);
    const touchmove   = m.hot('^-m-m-i-m-i-i-m-m-i-i-m-i-i-i-i-m-i-i-i-i-i', v);
    const touchend    = m.hot('^--a-o-----o-------a--o------a------o------', v);
    const touchcancel = m.hot('^------------i---------o---a-----o---------', v);

    // Do not use v in the expected drags. If, createPEventFromTouchEvent is
    // properly called, values will be maped back to their name.
    const drags = {
      d:               m.cold(       'am-i|'                               ),
      f:               m.cold(             'am-m|'                         ),
      g:               m.cold(                         'ai-i-i-m|'         )
    };
    const expected    = m.hot('^------d-----f-----------g-------------', drags);

    mockFromEvent({ touchstart, touchmove, touchend, touchcancel });

    m.expect(touchDrags('root-node')).toBeObservable(expected);
  }));

  // prettier-ignore
  it('calls fromEvent with the provided node', marbles(async m => {
    createPEventFromTouchEvent.mockImplementation(x => x.name);
    const touchstart  = m.hot('^b-----a-----a---c-', v);
    const touchmove   = m.hot('^-m-m-i-m-i-i-m-m-i', v);
    const touchend    = m.hot('^--a-o-----o-------', v);
    const touchcancel = m.hot('^------------i-----', v);
    const end         = m.hot('^-----------------x');

    mockFromEvent({ touchstart, touchmove, touchend, touchcancel });

    await toPromise(touchDrags('root-node').pipe(takeUntil(end)));
    expect(
      fromEvent.mock.calls.every(call => call[0] === 'root-node')
    ).toBe(true);
  }));

  // prettier-ignore
  it('creates sub-drags as behaviors',  marbles(m => {
    createPEventFromTouchEvent.mockImplementation(x => x.name);
    const touchstart  = m.hot('^---a--------------------------', v);
    const touchmove   = m.hot('^i---m----m---i--i----m-i------', v);
    const touchend    = m.hot('^-o--------------------o-------', v);
    const touchcancel = m.hot('^------------------------------', v);
    const iValues = {
      x:               m.cold(         'mm---i--i----m|'        ),
      y:               m.cold(                  'i---m|'        ),
      z:               m.cold(                            '|'  )
    };
    const i           = m.hot('^--------x--------y---------z', iValues);

    mockFromEvent({ touchstart, touchmove, touchend, touchcancel });

    m.expect(
      i.pipe(withLatestFrom(
        touchDrags('root-node'),
        (_, d) => merge(empty(), d)
      )
    )).toBeObservable(i);
  }));
});

describe('watchDrags', () => {
  it('calls the provided factories with root dom', () => {
    const factories = [
      jest.fn(() => of('a')),
      jest.fn(() => of('b')),
      jest.fn(() => of('c')),
    ];
    watchDrags('mock-dom', factories.slice());
    factories.forEach((f) => {
      expect(f.mock.calls).toEqual([['mock-dom']]);
    });
  });

  // prettier-ignore
  it('merges the observables returned by the factories', marbles(m => {
    const d1$ = m.hot(      '--a---b---c--d-e|');
    const d2$ = m.hot(      'f--g--h--|');
    const expected$ = m.hot('f-ag--(bh)c--d-e|');
    m.expect(
      watchDrags('mock-dom', [() => d1$, () => d2$])
    ).toBeObservable(expected$);
  }));
});
