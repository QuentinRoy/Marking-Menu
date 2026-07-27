/* eslint-disable @typescript-eslint/naming-convention -- Observable testing use capital letters for HOO */

import { Observable } from 'rxjs';
import { marbles } from 'rxjs-marbles/jest';
import { type Mock } from 'vitest';
import { dwellings } from '../move/dwelling.js';
import type { MarkingMenuModelItem } from '../types.js';
import { toPolar, type Point } from '../utils.js';
import type { NavigationDrag } from './expert-navigation.js';
import {
  menuSelection,
  noviceMoves,
  noviceNavigation,
  submenuNavigation,
  type NoviceNavigationOptions,
  type NoviceNotification,
} from './novice-navigation.js';

vi.mock('../utils');
vi.mock('../move/dwelling');

// `dwellings` is driven with placeholder tokens compared only structurally at
// runtime, so the mock is typed loosely.
const mockDwellings = vi.mocked(dwellings) as unknown as Mock<
  (...args: unknown[]) => Observable<unknown>
>;

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

const createOpenNotification = ({
  type = 'open',
  menu = 'mockMenu',
  center = 'mockMenuCenter',
  timeStamp: timestamp = 'mockTime',
}: {
  type?: string;
  menu?: unknown;
  center?: unknown;
  timeStamp?: unknown;
} = {}) => ({ type, menu, center, timeStamp: timestamp });

const createMoveNotification = (
  type: string,
  position: unknown,
  active: unknown = null,
) => ({
  type,
  active,
  ...toPolar(position as Point),
  position,
});

const createEndNotification = (
  type: string,
  position: unknown,
  active: unknown = null,
) => ({
  active,
  type,
  ...toPolar(position as Point),
  position,
  selection: active,
});

beforeEach(() => {
  // A class, not an arrow function: the mock is invoked as a constructor
  // (`new Event(...)`), and arrow functions can't be constructed.
  vi.spyOn(globalThis, 'Event').mockImplementation(
    class MockEvent {
      timeStamp = 'mockTime';
    } as unknown as typeof Event,
  );
  vi.mocked(toPolar).mockImplementation(([radius, azymuth]) => ({
    azymuth,
    radius,
  }));
});

describe('noviceMoves', () => {
  // prettier-ignore
  it('starts with open, emit moves when the position is close to the center', marbles(m => {
    const values = {
      a: { position: [10, 'a-az'] },
      b: { position: [20, 'b-az'] },
      O: createOpenNotification(),
      A: createMoveNotification('move', [10, 'a-az']),
      B: createMoveNotification('move', [20, 'b-az']),
      C: createEndNotification('cancel', [20, 'b-az'])
    };
    const drag$     = m.hot('----a--b--|', values);
    const expected$ = m.hot('O---A--B--(C|)', values);
    m
      .expect<unknown>(
        noviceMoves(
          drag$ as unknown as Observable<NavigationDrag>,
          'mockMenu' as unknown as MarkingMenuModelItem,
          {
            menuCenter: 'mockMenuCenter' as unknown as Point,
            minSelectionDist: 10_000
          }
        )
      )
      .toBeObservable(expected$);
  }));

  // prettier-ignore
  it('look for nearest item and emit changes when the position is far from the center', marbles(m => {
    const item1 = { name: 'mockActive1', isLeaf: true };
    const item2 = { name: 'mockActive2', isLeaf: true };
    const menu = {
      getNearestChild: vi
        .fn()
        .mockImplementationOnce(() => item1)
        .mockImplementationOnce(() => item1)
        .mockImplementationOnce(() => item2)
    };
    const values = {
      a: { position: [200, 'a-az'] },
      b: { position: [300, 'b-az'] },
      c: { position: [400, 'c-az'] },
      O: createOpenNotification({ menu }),
      A: createMoveNotification('change', [200, 'a-az'], item1),
      B: createMoveNotification('move', [300, 'b-az'], item1),
      C: createMoveNotification('change', [400, 'c-az'], item2),
      S: createEndNotification('select', [400, 'c-az'], item2)
    };
    const drag$     = m.hot('----a--bc--|', values);
    const expected$ = m.hot('O---A--BC--(S|)', values);
    m
      .expect<unknown>(
        noviceMoves(
          drag$ as unknown as Observable<NavigationDrag>,
          menu as unknown as MarkingMenuModelItem,
          {
            menuCenter: 'mockMenuCenter' as unknown as Point,
            minSelectionDist: 100
          }
        )
      )
      .toBeObservable(expected$);
  }));

  // prettier-ignore
  it('switch between no active items to active item', marbles(m => {
    const item1 = { name: 'mockActive1', isLeaf: true };
    const item2 = { name: 'mockActive2', isLeaf: true };
    const item3 = { name: 'mockActive3', isLeaf: true };
    const menu = {
      getNearestChild: vi
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
      O: createOpenNotification({ menu }),
      A: createMoveNotification('move', [10, 'a-az']),
      B: createMoveNotification('change', [200, 'b-az'], item1),
      C: createMoveNotification('move', [300, 'c-az'], item1),
      D: createMoveNotification('change', [20, 'd-az']),
      E: createMoveNotification('move', [50, 'e-az']),
      F: createMoveNotification('change', [400, 'f-az'], item2),
      G: createMoveNotification('change', [500, 'g-az'], item3),
      H: createMoveNotification('change', [50, 'h-az']),
      Z: createEndNotification('cancel', [50, 'h-az'])
    };
    const drag$     = m.hot('-a--b-cde-fg--h|', values);
    const expected$ = m.hot('OA--B-CDE-FG--H(Z|)', values);
    m
      .expect<unknown>(
        noviceMoves(
          drag$ as unknown as Observable<NavigationDrag>,
          menu as unknown as MarkingMenuModelItem,
          {
            menuCenter: 'mockMenuCenter' as unknown as Point,
            minSelectionDist: 100
          }
        )
      )
      .toBeObservable(expected$);
  }));

  // prettier-ignore
  it('emit cancel if selected item is not a leaf', marbles(m => {
    const item = { isLeaf: false };
    const menu = { getNearestChild: vi.fn(() => item) };
    const values = {
      a: { position: [200, 'a-az'] },
      O: createOpenNotification({ menu }),
      A: createMoveNotification('change', [200, 'a-az'], item),
      Z: createEndNotification('cancel', [200, 'a-az'], item)
    };
    const drag$ =     m.hot('-a--|)', values);
    const expected$ = m.hot('OA--(Z|)', values);
    m
      .expect<unknown>(
        noviceMoves(
          drag$ as unknown as Observable<NavigationDrag>,
          menu as unknown as MarkingMenuModelItem,
          {
            menuCenter: 'mockMenuCenter' as unknown as Point,
            minSelectionDist: 100
          }
        )
      )
      .toBeObservable(expected$);
  }));

  // prettier-ignore
  it('cancels rather than selecting when the final drag notification is canceled', marbles(m => {
    const item = { isLeaf: true };
    const menu = { getNearestChild: vi.fn(() => item) };
    const values = {
      a: { position: [200, 'a-az'] },
      c: { position: [300, 'c-az'], canceled: true },
      O: createOpenNotification({ menu }),
      A: createMoveNotification('change', [200, 'a-az'], item),
      C: { ...createMoveNotification('move', [300, 'c-az'], item), canceled: true },
      Z: { ...createEndNotification('cancel', [300, 'c-az'], item), canceled: true }
    };
    const drag$ = m.hot('-ac|', values);
    const expected$ = m.hot('OAC(Z|)', values);
    m
      .expect<unknown>(
        noviceMoves(
          drag$ as unknown as Observable<NavigationDrag>,
          menu as unknown as MarkingMenuModelItem,
          {
            menuCenter: 'mockMenuCenter' as unknown as Point,
            minSelectionDist: 100
          }
        )
      )
      .toBeObservable(expected$);
  }));
});

// prettier-ignore
test('menuSelection', marbles(m => {
  const move$ = 'mockMove';
  const values = {
    a: { active: { isLeaf: true }, radius: 11 },
    b: { active: { isLeaf: true }, radius: 9 },
    c: { active: { isLeaf: false }, radius: 11 },
    d: { active: { isLeaf: false }, radius: 9 }
  };
  const dwelling$ = m.hot('--a-b--c-d-|', values);
  const expected$ = m.hot('-------c---|', values);

  mockDwellings.mockImplementation(() => dwelling$);

  m
    .expect<unknown>(
      menuSelection(
        move$ as unknown as Observable<NoviceNotification<NavigationDrag>>,
        {
          submenuOpeningDelay: 'mockDelay',
          movementsThreshold: 'mockThreshold',
          minMenuSelectionDist: 10
        } as unknown as Parameters<typeof menuSelection>[1]
      )
    )
    .toBeObservable(expected$);
  m.flush();
  expect(mockDwellings.mock.calls).toEqual([
    ['mockMove', {
      delay: 'mockDelay',
      movementsThreshold: 'mockThreshold'
    }]
  ])
}));

// prettier-ignore
test('submenuNavigation', marbles(m => {
  const subNav = vi.fn(
    (_drag: unknown, active: { mapped: string }, _options?: unknown) =>
      active.mapped
  );
  const values = {
    a: { active: { mapped: 'A' }, position: 'a-pos', mapped: 'A' },
    b: { active: { mapped: 'B' }, position: 'b-pos', mapped: 'B' },
    A: 'A',
    B: 'B'
  };
  const src = m.hot('--a-b-|', values);
  const out = m.hot('--A-B-|', values);
  m
    .expect<unknown>(
      submenuNavigation(
        ...([src, 'mockDrag', subNav, { opt: 'mockOpt' }] as unknown as Parameters<typeof submenuNavigation>)
      )
    )
    .toBeObservable(out);
  m.flush();
  expect(subNav.mock.calls).toEqual([
    ['mockDrag', { mapped: 'A' }, { menuCenter: 'a-pos', opt: 'mockOpt' }],
    ['mockDrag', { mapped: 'B' }, { menuCenter: 'b-pos', opt: 'mockOpt' }]
  ]);
}));

test(
  'noviceNavigation',
  marbles((m) => {
    const move$ = m.hot('a-b--c---d-e-|');
    const moveSub = '^---!';
    const subs = {
      f: m.cold('-ij---k|'),
      // `g` and `h` below are not supposed to be used.
      g: m.cold('-o-o-o-o-o-o-o-o|'),
      h: m.cold('ooo|'),
    };
    const fSub = '----^------!';
    const subNavs$ = m.hot('----f--g------h|', subs);
    const subNavsSub = '^---!';
    const expected$ = m.hot('a-b--ij---k|');

    const mockNoviceMoves = vi.fn((..._args: unknown[]) => move$);
    const mockMenuSelection = vi.fn(
      (..._args: unknown[]) => 'mockMenuSelection',
    );
    const mockSubmenuNavigation = vi.fn((..._args: unknown[]) => subNavs$);

    m.expect<unknown>(
      noviceNavigation(
        'mockDrags' as unknown as Observable<NavigationDrag>,
        'mockMenu' as unknown as MarkingMenuModelItem,
        {
          minSelectionDist: 'mock-minSelectionDist',
          minMenuSelectionDist: 'mock-minMenuSelectionDist',
          movementsThreshold: 'mock-movementsThreshold',
          submenuOpeningDelay: 'mock-submenuOpeningDelay',
          menuCenter: 'mock-menuCenter',
          noviceMoves: mockNoviceMoves,
          menuSelection: mockMenuSelection,
          submenuNavigation: mockSubmenuNavigation,
        } as unknown as NoviceNavigationOptions<NavigationDrag>,
      ),
    ).toBeObservable(expected$);
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
          minSelectionDist: 'mock-minSelectionDist',
        },
      ],
    ]);
    {
      const [[moveArg$, ...argRest], ...otherCalls] = mockMenuSelection.mock
        .calls as [unknown[], ...unknown[][]];
      // It is difficult at this point to check that moveArg$ did emit the
      // values in move. It might be possible, but I did not bother.
      expect(moveArg$).toBeInstanceOf(Observable);
      expect(argRest).toEqual([
        {
          submenuOpeningDelay: 'mock-submenuOpeningDelay',
          movementsThreshold: 'mock-movementsThreshold',
          minMenuSelectionDist: 'mock-minMenuSelectionDist',
        },
      ]);
      expect(otherCalls.length).toBe(0);
    }

    expect(mockSubmenuNavigation.mock.calls).toEqual([
      [
        'mockMenuSelection',
        'mockDrags',
        noviceNavigation,
        {
          minSelectionDist: 'mock-minSelectionDist',
          minMenuSelectionDist: 'mock-minMenuSelectionDist',
          movementsThreshold: 'mock-movementsThreshold',
          submenuOpeningDelay: 'mock-submenuOpeningDelay',
          noviceMoves: mockNoviceMoves,
          menuSelection: mockMenuSelection,
          submenuNavigation: mockSubmenuNavigation,
        },
      ],
    ]);
  }),
);
