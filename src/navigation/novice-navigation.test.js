import 'rxjs';
import { marbles } from 'rxjs-marbles/jest';
import noviceNavigation, {
  noviceMoves,
  menuSelection,
  subMenuNavigation
} from './novice-navigation';
import { toPolar } from '../utils';
import { dwellings } from '../move';

jest.mock('../utils');
jest.mock('../move');

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetAllMocks();
});

const OpenNotif = ({
  type = 'open',
  menu = 'mockMenu',
  center = 'mockMenuCenter',
  timeStamp = 'mockTime'
} = {}) => ({ type, menu, center, timeStamp });

const MNotif = (type, position, active = null) => ({
  type,
  active,
  ...toPolar(position),
  position
});

const EndNotif = (type, position, active = null) => ({
  active,
  type,
  ...toPolar(position),
  position,
  selection: active
});

beforeEach(() => {
  jest.spyOn(performance, 'now').mockImplementationOnce(() => 'mockTime');
  toPolar.mockImplementation(([radius, azymuth]) => ({ azymuth, radius }));
});

describe('noviceMoves', () => {
  // prettier-ignore
  it('starts with open, emit moves when the position is close to the center', marbles(m => {
    const values = {
      a: { position: [10, 'a-az'] },
      b: { position: [20, 'b-az'] },
      O: OpenNotif(),
      A: MNotif('move', [10, 'a-az']),
      B: MNotif('move', [20, 'b-az']),
      C: EndNotif('cancel', [20, 'b-az'])
    };
    const drag$     = m.hot('----a--b--|', values);
    const expected$ = m.hot('O---A--B--(C|)', values);
    m
      .expect(
        noviceMoves(drag$, 'mockMenu', {
          menuCenter: 'mockMenuCenter',
          minSelectionDist: 10000
        })
      )
      .toBeObservable(expected$);
  }));

  // prettier-ignore
  it('look for nearest item and emit changes when the position is far from the center', marbles(m => {
    const item1 = { name: 'mockActive1', isLeaf: () => true };
    const item2 = { name: 'mockActive2', isLeaf: () => true };
    const menu = {
      getNearestChild: jest
        .fn()
        .mockImplementationOnce(() => item1)
        .mockImplementationOnce(() => item1)
        .mockImplementationOnce(() => item2)
    };
    const values = {
      a: { position: [200, 'a-az'] },
      b: { position: [300, 'b-az'] },
      c: { position: [400, 'c-az'] },
      O: OpenNotif({ menu }),
      A: MNotif('change', [200, 'a-az'], item1),
      B: MNotif('move', [300, 'b-az'], item1),
      C: MNotif('change', [400, 'c-az'], item2),
      S: EndNotif('select', [400, 'c-az'], item2)
    };
    const drag$     = m.hot('----a--bc--|', values);
    const expected$ = m.hot('O---A--BC--(S|)', values);
    m
      .expect(
        noviceMoves(drag$, menu, {
          menuCenter: 'mockMenuCenter',
          minSelectionDist: 100
        })
      )
      .toBeObservable(expected$);
  }));

  // prettier-ignore
  it('switch between no active items to active item', marbles(m => {
    const item1 = { name: 'mockActive1', isLeaf: () => true };
    const item2 = { name: 'mockActive2', isLeaf: () => true };
    const item3 = { name: 'mockActive3', isLeaf: () => true };
    const menu = {
      getNearestChild: jest
        .fn()
        .mockImplementationOnce(() => item1)
        .mockImplementationOnce(() => item1)
        .mockImplementationOnce(() => item2)
        .mockImplementationOnce(() => item3)
    };
    const values = {
      a: { position: [10, 'a-az'] },
      b: { position: [200, 'b-az'] },
      c: { position: [300, 'c-az'] },
      d: { position: [20, 'd-az'] },
      e: { position: [50, 'e-az'] },
      f: { position: [400, 'f-az'] },
      g: { position: [500, 'g-az'] },
      h: { position: [50, 'h-az'] },
      O: OpenNotif({ menu }),
      A: MNotif('move', [10, 'a-az']),
      B: MNotif('change', [200, 'b-az'], item1),
      C: MNotif('move', [300, 'c-az'], item1),
      D: MNotif('change', [20, 'd-az']),
      E: MNotif('move', [50, 'e-az']),
      F: MNotif('change', [400, 'f-az'], item2),
      G: MNotif('change', [500, 'g-az'], item3),
      H: MNotif('change', [50, 'h-az']),
      Z: EndNotif('cancel', [50, 'h-az'])
    };
    const drag$     = m.hot('-a--b-cde-fg--h|', values);
    const expected$ = m.hot('OA--B-CDE-FG--H(Z|)', values);
    m
      .expect(
        noviceMoves(drag$, menu, {
          menuCenter: 'mockMenuCenter',
          minSelectionDist: 100
        })
      )
      .toBeObservable(expected$);
  }));

  // prettier-ignore
  it('emit cancel if selected item is not a leaf', marbles(m => {
    const item = { isLeaf: () => false };
    const menu = { getNearestChild: jest.fn(() => item) };
    const values = {
      a: { position: [200, 'a-az'] },
      O: OpenNotif({ menu }),
      A: MNotif('change', [200, 'a-az'], item),
      Z: EndNotif('cancel', [200, 'a-az'], item)
    };
    const drag$ =     m.hot('-a--|)', values);
    const expected$ = m.hot('OA--(Z|)', values);
    m
      .expect(
        noviceMoves(drag$, menu, {
          menuCenter: 'mockMenuCenter',
          minSelectionDist: 100
        })
      )
      .toBeObservable(expected$);
  }));
});

// prettier-ignore
test('menuSelection', marbles(m => {
  const move$ = 'mockMove';
  const values = {
    a: { active: { isLeaf: () => true }, radius: 11 },
    b: { active: { isLeaf: () => true }, radius: 9 },
    c: { active: { isLeaf: () => false }, radius: 11 },
    d: { active: { isLeaf: () => false }, radius: 9 }
  };
  const dwelling$ = m.hot('--a-b--c-d-|', values);
  const expected$ = m.hot('-------c---|', values);

  dwellings.mockImplementation(() => dwelling$);

  m
    .expect(
      menuSelection(move$, {
        subMenuOpeningDelay: 'mockDelay',
        movementsThreshold: 'mockThreshold',
        minMenuSelectionDist: 10
      })
    )
    .toBeObservable(expected$);
  m.flush();
  expect(dwellings.mock.calls).toEqual([
    ['mockMove', 'mockDelay', 'mockThreshold']
  ])
}));

// prettier-ignore
test('subMenuNavigation', marbles(m => {
  const subNav = jest.fn((n, active) => active.mapped);
  const values = {
    a: { active: { mapped: 'A' }, position: 'a-pos', mapped: 'A' },
    b: { active: { mapped: 'B' }, position: 'b-pos', mapped: 'B' },
    A: 'A',
    B: 'B'
  };
  const src = m.hot('--a-b-|', values);
  const out = m.hot('--A-B-|', values);
  m
    .expect(subMenuNavigation(src, 'mockDrag', subNav, { opt: 'mockOpt' }))
    .toBeObservable(out);
  m.flush();
  expect(subNav.mock.calls).toEqual([
    ['mockDrag', { mapped: 'A' }, { menuCenter: 'a-pos', opt: 'mockOpt' }],
    ['mockDrag', { mapped: 'B' }, { menuCenter: 'b-pos', opt: 'mockOpt' }]
  ]);
}));

// prettier-ignore
test('noviceNavigation', marbles(m => {
  const move$     = m.hot('a-b--c---d-e-|');
  const moveSub   =       '^---!'
  const subs = {
    f: m.cold(                 '-ij---k|'),
    // g and h below are not supposed to be used.
    g: m.cold(                   '-o-o-o-o-o-o-o-o|'),
    h: m.cold(                          'ooo|')
  };
  const fSub =            '----^------!'
  const subNavs$  = m.hot('----f--g------h|', subs);
  const subNavsSub =      '^---!'
  const expected$ = m.hot('a-b--ij---k|');

  const mockNoviceMoves = jest.fn(() => move$);
  const mockMenuSelection = jest.fn(() => 'mockMenuSelection');
  const mockSubMenuNavigation = jest.fn(() => subNavs$);

  m
    .expect(
      noviceNavigation('mockDrags', 'mockMenu', {
        minSelectionDist: 'mock-minSelectionDist',
        minMenuSelectionDist: 'mock-minMenuSelectionDist',
        movementsThreshold: 'mock-movementsThreshold',
        subMenuOpeningDelay: 'mock-subMenuOpeningDelay',
        menuCenter: 'mock-menuCenter',
        noviceMoves: mockNoviceMoves,
        menuSelection: mockMenuSelection,
        subMenuNavigation: mockSubMenuNavigation
      })
    )
    .toBeObservable(expected$);
  m.expect(move$).toHaveSubscriptions(moveSub);
  m.expect(subNavs$).toHaveSubscriptions(subNavsSub);
  m.expect(subs.f).toHaveSubscriptions(fSub);
  m.expect(subs.g).toHaveSubscriptions([]);
  m.expect(subs.h).toHaveSubscriptions([]);
  m.flush();
  expect(mockNoviceMoves.mock.calls).toEqual([
    [
      'mockDrags',
      'mockMenu',
      {
        menuCenter: 'mock-menuCenter',
        minSelectionDist: 'mock-minSelectionDist'
      }
    ]
  ]);
  expect(mockMenuSelection.mock.calls).toEqual([
    [
      // share() is unfortunate, but expect will not work without it.
      move$.share(),
      {
        subMenuOpeningDelay: 'mock-subMenuOpeningDelay',
        movementsThreshold: 'mock-movementsThreshold',
        minMenuSelectionDist: 'mock-minMenuSelectionDist'
      }
    ]
  ]);
  expect(mockSubMenuNavigation.mock.calls).toEqual([
    [
      'mockMenuSelection',
      'mockDrags',
      noviceNavigation,
      {
        minSelectionDist: 'mock-minSelectionDist',
        minMenuSelectionDist: 'mock-minMenuSelectionDist',
        movementsThreshold: 'mock-movementsThreshold',
        subMenuOpeningDelay: 'mock-subMenuOpeningDelay',
        noviceMoves: mockNoviceMoves,
        menuSelection: mockMenuSelection,
        subMenuNavigation: mockSubMenuNavigation
      }
    ]
  ]);
}));
