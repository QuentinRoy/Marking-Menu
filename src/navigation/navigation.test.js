import { of } from 'rxjs';
import { publishBehavior, scan, map } from 'rxjs/operators';
import { marbles } from 'rxjs-marbles/jest';
import navigation, {
  confirmedExpertNavigationHOO,
  confirmedNoviceNavigationHOO,
  startup,
  navigationFromDrag
} from './navigation';
import expertNavigation from './expert-navigation';
import { longMoves, dwellings } from '../move';
import noviceNavigation from './novice-navigation';

jest.mock('./expert-navigation');
jest.mock('./novice-navigation');
jest.mock('../move');

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetAllMocks();
});

describe('confirmedExpertNavigationHOO', () => {
  // prettier-ignore
  it('emits expert navigation observables once they are confirmed', marbles(m => {
    const values = {
      a: { stroke: 'a', model: 'mock-model' },
      b: { stroke: 'ab', model: 'mock-model' },
      c: { stroke: 'abc', model: 'mock-model' },
      d: { stroke: 'abcd', model: 'mock-model' },
      e: { stroke: 'abcde', model: 'mock-model'  },
      f: { stroke: 'abcdef', model: 'mock-model' },
      D: { stroke: 'abcd', model: 'mock-model', mode: 'expert' },
      E: { stroke: 'abcde', model: 'mock-model', mode: 'expert' },
      F: { stroke: 'abcdef', model: 'mock-model', mode: 'expert' }
    };
    // Drag is a behavior and in this case it matters.
    const drag$ = m.hot(    '--a-b--c--d-e---f--|').pipe(publishBehavior());
    const long$ = m.hot(    '-------c----e------|', values);
    const sub$ = m.cold(           '---D-E---F--|', values);
    const expected$ = m.hot('-------(X|)'         , { X: sub$ });
    drag$.connect();

    expertNavigation.mockImplementation(
      (obs$, model, init) => obs$.pipe(scan(
        (prev, n) => ({ stroke: prev.stroke + n, model }),
        { stroke: init || '' }
      )
    ));
    longMoves.mockImplementation(() => long$);

    m
      .expect(confirmedExpertNavigationHOO(drag$, 'mock-model', {
        movementsThreshold: 'mock-threshold'
      }))
      .toBeObservable(expected$);
    m.flush();
    expect(longMoves.mock.calls[0][1]).toEqual('mock-threshold');
    expect(longMoves).toHaveBeenCalledTimes(1);
  }));
});

describe('confirmedNoviceNavigationHOO', () => {
  // prettier-ignore
  it('emits novice navigation observables once they are confirmed', marbles(m => {
    const createNotif = name => ({
      name,
      mode: 'novice',
      model: 'mock-model',
      options: {
        opt: 'mock-opt',
        menuCenter: 'mock-start-position',
        noviceDwellingTime: 'mock-dwelling',
        movementsThreshold: 'mock-move-threshold'
      }
    });
    const values = {
      C: createNotif('c'),
      D: createNotif('d'),
      E: createNotif('e'),
      F: createNotif('f')
    };
    // Drag is a behavior and in this case it matters.
    const drag$ = m.hot(     '-a-b---c-d---e--f--|').pipe(publishBehavior());
    const dwellings$ = m.hot('------b-----d------|');
    const sub$ = m.cold(           '-C-D---E--F--|', values);
    const expected$ = m.hot( '------(X|)'          , { X: sub$ });
    drag$.connect();

    noviceNavigation.mockImplementation(
      (obs$, model, options) => obs$.pipe(map(n => ({ name: n, model, options })))
    );
    dwellings.mockImplementation(() => dwellings$);

    m
      .expect(
        confirmedNoviceNavigationHOO(
          drag$,
          { position: 'mock-start-position' },
          'mock-model',
          {
            opt: 'mock-opt',
            noviceDwellingTime: 'mock-dwelling',
            movementsThreshold: 'mock-move-threshold'
          }
        )
      )
      .toBeObservable(expected$);
    m.flush();
    expect(dwellings.mock.calls).toEqual([
      [drag$, 'mock-dwelling', 'mock-move-threshold']
    ]);
  }));
});

describe('startup', () => {
  // prettier-ignore
  it('emits expert-like notifications', marbles(m => {
    expertNavigation.mockImplementation(obs$ =>
      obs$.pipe(map(n => ({ name: n, type: 'mock-type' })))
    );
    const values = {
      A: { name: 'a', mode: 'startup', type: 'start' },
      B: { name: 'b', mode: 'startup', type: 'mock-type' },
      C: { name: 'c', mode: 'startup', type: 'mock-type' }
    };
    const drag$ = m.hot(    '-a-bc--|');
    const expected$ = m.hot('-A-BC--|', values);
    m.expect(startup(drag$)).toBeObservable(expected$);
  }));
});

describe('navigationFromDrag', () => {
  let mockConfirmedExpertNavigationHOO;
  let mockConfirmedNoviceNavigationHOO;
  let mockStartup;
  let callNavigationFromDrag;

  beforeEach(() => {
    mockConfirmedExpertNavigationHOO = jest.fn(() => of());
    mockConfirmedNoviceNavigationHOO = jest.fn(() => of());
    mockStartup = jest.fn(() => of());
    callNavigationFromDrag = () =>
      navigationFromDrag(
        'mock-drag$',
        'mock-start',
        'mock-model',
        'mock-options',
        {
          confirmedExpertNavigationHOO: mockConfirmedExpertNavigationHOO,
          confirmedNoviceNavigationHOO: mockConfirmedNoviceNavigationHOO,
          startup: mockStartup
        }
      );
  });

  it('properly calls startup, confirmedExpertNavigationHOO, and confirmedNoviceNavigationHOO', () => {
    callNavigationFromDrag();
    expect(mockStartup.mock.calls).toEqual([['mock-drag$', 'mock-model']]);
    expect(mockConfirmedExpertNavigationHOO.mock.calls).toEqual([
      ['mock-drag$', 'mock-model', 'mock-options']
    ]);
    expect(mockConfirmedNoviceNavigationHOO.mock.calls).toEqual([
      ['mock-drag$', 'mock-start', 'mock-model', 'mock-options']
    ]);
  });

  // prettier-ignore
  it('starts with startup and switches to novice navigation if it is first', marbles(m => {
    const subs = {
      A: m.cold(                 'aa-a--a-a|'),
      B: m.cold(                               '-b-b-|'),
      C: m.cold(                     'cccc-c-c-c|'),
      D: m.cold(                                         'dd-dd-d|')
    };
    const startup$ = m.hot( 'oo-|');
    const novice$$ = m.hot( '-----A-------------B--|', subs);
    const expert$$ = m.hot( '---------C-------------------D---|', subs);
    const expected$ = m.hot('oo---aa-a--a-a------b-b-|');

    const noviceSub =       '^---------------------!';
    const expertSub =       '^----!';
    const startupSub =      '^--!';

    mockStartup.mockImplementation(() => startup$);
    mockConfirmedExpertNavigationHOO.mockImplementation(() => expert$$);
    mockConfirmedNoviceNavigationHOO.mockImplementation(() => novice$$);

    m.expect(callNavigationFromDrag()).toBeObservable(expected$);
    m.expect(expert$$).toHaveSubscriptions(expertSub);
    m.expect(novice$$).toHaveSubscriptions(noviceSub);
    m.expect(startup$).toHaveSubscriptions(startupSub);
  }));

  // prettier-ignore
  it('starts with startup and switches to expert navigation if it is first', marbles(m => {
    const subs = {
      A: m.cold(                 'aa-a--a-a|'),
      B: m.cold(                               '-b-b-|'),
      C: m.cold(                'cccc-c-c-c|'),
      D: m.cold(                                    'dd-dd-d|')
    };
    const startup$ = m.hot( 'oo-|');
    const novice$$ = m.hot( '-----A-------------B--|', subs);
    const expert$$ = m.hot( '----C-------------------D---|', subs);
    const expected$ = m.hot('oo--cccc-c-c-c----------dd-dd-d|');

    const noviceSub =       '^---!';
    const expertSub =       '^---------------------------!';
    const startupSub =      '^--!';

    mockStartup.mockImplementation(() => startup$);
    mockConfirmedExpertNavigationHOO.mockImplementation(() => expert$$);
    mockConfirmedNoviceNavigationHOO.mockImplementation(() => novice$$);

    m.expect(callNavigationFromDrag()).toBeObservable(expected$);
    m.expect(expert$$).toHaveSubscriptions(expertSub);
    m.expect(novice$$).toHaveSubscriptions(noviceSub);
    m.expect(startup$).toHaveSubscriptions(startupSub);
  }));
});

// prettier-ignore
describe('navigation', () => {
  it('forward drag observables to navigationFromDrag from a drag higher order observable', marbles(m => {
    const transformedValues = {
      a: { name: 'a', start: 'a', menu: 'mock-menu', options: 'mock-options' },
      b: { name: 'b', start: 'a', menu: 'mock-menu', options: 'mock-options' },
      c: { name: 'c', start: 'a', menu: 'mock-menu', options: 'mock-options' },
      i: { name: 'i', start: 'i', menu: 'mock-menu', options: 'mock-options' },
      j: { name: 'j', start: 'i', menu: 'mock-menu', options: 'mock-options' },
      k: { name: 'k', start: 'i', menu: 'mock-menu', options: 'mock-options' },
      l: { name: 'l', start: 'l', menu: 'mock-menu', options: 'mock-options' },
      m: { name: 'm', start: 'l', menu: 'mock-menu', options: 'mock-options' }
    };
    const subs = {
      A: m.hot('-z---u----a--^----b-c-|').pipe(publishBehavior()),
      E: m.hot('----e--------^----eee-ee-e|').pipe(publishBehavior()),
      J: m.hot('--------i----^-------------j----k|').pipe(publishBehavior()),
      P: m.hot(          ' l-^-------------------------m-|').pipe(publishBehavior())
    };
    const drags$ = m.hot(   'A----E-------J-------P-|', subs);
    const expected$ = m.hot('a----b-c-----ij----k-l----m-|', transformedValues);

    Object.values(subs).forEach(sub => sub.connect());

    const mockNavFromDrag = jest.fn((obs, start, menu, options) =>
      obs.pipe(map(name => ({ name, start, menu, options })))
    );

    m
      .expect(navigation(drags$, 'mock-menu', 'mock-options', mockNavFromDrag))
      .toBeObservable(expected$);
  }));
});
