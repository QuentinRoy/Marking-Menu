import { EMPTY, fromEvent, merge, of, type Observable } from 'rxjs';
import { marbles } from 'rxjs-marbles';
import { takeUntil, withLatestFrom } from 'rxjs/operators';
import { type Mock } from 'vitest';
import { mouseDrags, touchDrags, watchDrags } from './linear-drag.js';
import {
  createPointerEventFromMouseEvent,
  createPointerEventFromTouchEvent,
} from './pointer-events.js';

const toPromise = async (obs: Observable<unknown>): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    obs.subscribe({
      complete: resolve,
      error: reject,
    });
  });

vi.mock('./pointer-events', () => ({
  createPointerEventFromTouchEvent: vi.fn(() => {
    // Mocked.
  }),
  createPointerEventFromMouseEvent: vi.fn(() => {
    // Mocked.
  }),
}));

vi.mock('rxjs', async () => ({
  ...(await vi.importActual('rxjs')),
  fromEvent: vi.fn(() => {
    // Mocked.
  }),
}));

// The mocked fromEvent accepts any target; the node only serves as an
// identity token in these tests.
const rootNode = 'root-node' as unknown as HTMLElement;
const mockDom = 'mock-dom' as unknown as HTMLElement;

// The module is fully mocked; these doubles map fake events to marble tokens
// and intentionally do not match the real generic signatures.
const mockCreatePointerEventFromTouchEvent =
  createPointerEventFromTouchEvent as unknown as Mock<
    (x: { name: string }) => unknown
  >;
const mockCreatePointerEventFromMouseEvent =
  createPointerEventFromMouseEvent as unknown as Mock<(x: string) => unknown>;

beforeEach(() => {
  mockCreatePointerEventFromTouchEvent.mockImplementation((x) => x);
  mockCreatePointerEventFromMouseEvent.mockImplementation((x) => x);
});

afterEach(() => {
  vi.resetAllMocks();
});

// FromEvent's deprecated explicit-type-parameter signatures flag any
// materialization of its type; the mock only needs a simple signature.
// eslint-disable-next-line @typescript-eslint/no-deprecated
const fromEventMock = fromEvent as unknown as Mock<
  (target: unknown, eventName: string) => Observable<unknown>
>;

const mockFromEvent = (observables: Record<string, Observable<unknown>>) => {
  fromEventMock.mockImplementation(
    (_: unknown, evt: string) => observables[evt] ?? EMPTY,
  );
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
    mockCreatePointerEventFromMouseEvent.mockImplementation(x => `m${x}`)

    // Marble tokens stand in for pointer notifications; rxjs-marbles compares
    // structurally at runtime.
    const drags$: Observable<unknown> = mouseDrags(rootNode);
    m.expect(drags$).toBeObservable(expected);
    m.expect(mousemove).toHaveSubscriptions([moveUpSub1, moveUpSub2]);
    m.expect(mouseup).toHaveSubscriptions([moveUpSub1, moveUpSub2]);
  }));

  it('calls fromEvent with the provided node', marbles(async m => {
    const mousedown = m.hot('^----a--------------j----------');
    const mousemove = m.hot('^-b-c-----d-e--f-g------k---l--');
    const mouseup   = m.hot('^-h----------i------------m----');
    const end       = m.hot('^-----------------------------x');

    mockFromEvent({ mousedown, mousemove, mouseup });

    await toPromise(mouseDrags(rootNode).pipe(takeUntil(end)));
    expect(
      fromEventMock.mock.calls.every(call => Object.is(call[0], rootNode))
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
    const latest$ = i.pipe(
      withLatestFrom(mouseDrags(rootNode), (_, d) => merge(EMPTY, d)),
    );
    m.expect(latest$).toBeObservable(i);
  }));
});

describe('touchDrags', () => {
  let v: Record<string, { targetTouches: { length: number }; name: string }>;
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
    mockCreatePointerEventFromTouchEvent.mockImplementation(x => x.name);
    const touchstart  = m.hot('^b-----a-----a---c--b----a-----------------', v);
    const touchmove   = m.hot('^-m-m-i-m-i-i-m-m-i-i-m-i-i-i-i-m-i-i-i-i-i', v);
    const touchend    = m.hot('^--a-o-----o-------a--o------a------o------', v);
    const touchcancel = m.hot('^------------i---------o---a-----o---------', v);

    // Do not use v in the expected drags. If, createPointerEventFromTouchEvent is
    // properly called, values will be maped back to their name.
    const drags = {
      d:               m.cold(       'am-i|'                               ),
      f:               m.cold(             'am-m|'                         ),
      g:               m.cold(                         'ai-i-i-m|'         )
    };
    const expected    = m.hot('^------d-----f-----------g-------------', drags);

    mockFromEvent({ touchstart, touchmove, touchend, touchcancel });

    // Marble tokens stand in for pointer notifications; rxjs-marbles compares
    // structurally at runtime.
    const drags$: Observable<unknown> = touchDrags(rootNode);
    m.expect(drags$).toBeObservable(expected);
  }));

  // prettier-ignore
  it('calls fromEvent with the provided node', marbles(async m => {
    mockCreatePointerEventFromTouchEvent.mockImplementation(x => x.name);
    const touchstart  = m.hot('^b-----a-----a---c-', v);
    const touchmove   = m.hot('^-m-m-i-m-i-i-m-m-i', v);
    const touchend    = m.hot('^--a-o-----o-------', v);
    const touchcancel = m.hot('^------------i-----', v);
    const end         = m.hot('^-----------------x');

    mockFromEvent({ touchstart, touchmove, touchend, touchcancel });

    await toPromise(touchDrags(rootNode).pipe(takeUntil(end)));
    expect(
      fromEventMock.mock.calls.every(call => Object.is(call[0], rootNode))
    ).toBe(true);
  }));

  // prettier-ignore
  it('creates sub-drags as behaviors',  marbles(m => {
    mockCreatePointerEventFromTouchEvent.mockImplementation(x => x.name);
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

    const latest$ = i.pipe(
      withLatestFrom(touchDrags(rootNode), (_, d) => merge(EMPTY, d)),
    );
    m.expect(latest$).toBeObservable(i);
  }));
});

describe('watchDrags', () => {
  it('calls the provided factories with root dom', () => {
    const factories = [
      vi.fn(() => of('a')),
      vi.fn(() => of('b')),
      vi.fn(() => of('c')),
    ];
    watchDrags(mockDom, { dragObsFactories: [...factories] });
    for (const f of factories) {
      expect(f.mock.calls).toEqual([[mockDom]]);
    }
  });

  // prettier-ignore
  it('merges the observables returned by the factories', marbles(m => {
    const d1$ = m.hot(      '--a---b---c--d-e|');
    const d2$ = m.hot(      'f--g--h--|');
    const expected$ = m.hot('f-ag--(bh)c--d-e|');
    m.expect(
      watchDrags(mockDom, {
        dragObsFactories: [() => d1$, () => d2$],
      }),
    ).toBeObservable(expected$);
  }));
});
