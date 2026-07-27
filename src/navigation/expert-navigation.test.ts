/* eslint-disable @typescript-eslint/naming-convention -- Observable testing use capital letters for HOO */
import { type Observable } from 'rxjs';
import { marbles } from 'rxjs-marbles';
import { type Mock } from 'vitest';
import { recognizeMarkingMenuStroke as recognize } from '../recognizer/recognize-mm-stroke.js';
import type { MarkingMenuModelItem } from '../types.js';
import type { Point } from '../utils.js';
import { expertNavigation, type NavigationDrag } from './expert-navigation.js';

vi.mock('../recognizer/recognize-mm-stroke');

// `recognize` and the drag/model tokens used below are placeholders compared
// only structurally at runtime, so the mock is typed loosely.
const mockRecognize = vi.mocked(recognize) as unknown as Mock<
  (...args: unknown[]) => unknown
>;

afterEach(() => {
  vi.resetAllMocks();
});

describe('expertNavigation', () => {
  // prettier-ignore
  it('emit draw notifications from drags', marbles(m => {
    const values = {
      a: { position: 'a-pos' },
      b: { position: 'b-pos' },
      c: { position: 'c-pos' },
      A: {
        type: 'draw',
        position: 'a-pos',
        stroke: ['i-pos', 'j-pos', 'a-pos']
      },
      B: {
        type: 'draw',
        position: 'b-pos',
        stroke: ['i-pos', 'j-pos', 'a-pos', 'b-pos']
      },
      C: {
        type: 'draw',
        position: 'c-pos',
        stroke: ['i-pos', 'j-pos', 'a-pos', 'b-pos', 'c-pos']
      }
    };
    const drag$     = m.hot('^--a-b---c-', values);
    const expected$ = m.hot('^--A-B---C-', values);
    m
      .expect<unknown>(
        expertNavigation(
          drag$ as unknown as Observable<NavigationDrag>,
          'model' as unknown as MarkingMenuModelItem,
          ['i-pos', 'j-pos'] as unknown as Point[]
        )
      )
      .toBeObservable(expected$);
  }));

  // prettier-ignore
  it('supports default initStroke', marbles(m => {
    const values = {
      a: { position: 'a-pos' },
      b: { position: 'b-pos' },
      A: { type: 'draw', position: 'a-pos', stroke: ['a-pos'] },
      B: { type: 'draw', position: 'b-pos', stroke: ['a-pos', 'b-pos'] }
    };
    const drag$     = m.hot('^ab--', values);
    const expected$ = m.hot('^AB--', values);
    m
      .expect<unknown>(
        expertNavigation(
          drag$ as unknown as Observable<NavigationDrag>,
          'model' as unknown as MarkingMenuModelItem
        )
      )
      .toBeObservable(expected$);
  }));

  // prettier-ignore
  it('emits select on completion if an item is recognized', marbles(m => {
    mockRecognize.mockImplementation(() => 'selection');
    const values = {
      a: { position: 'a-pos' },
      A: { type: 'draw', position: 'a-pos', stroke: ['a-pos'] },
      s: {
        type: 'select',
        position: 'a-pos',
        stroke: ['a-pos'],
        selection: 'selection'
      }
    };
    const drag$ = m.hot('^-a-|', values);
    const expected$ = m.hot('^-A-(s|)', values);
    m
      .expect<unknown>(
        expertNavigation(
          drag$ as unknown as Observable<NavigationDrag>,
          'model' as unknown as MarkingMenuModelItem
        )
      )
      .toBeObservable(expected$);
    m.flush();
    expect(mockRecognize.mock.calls).toEqual([[['a-pos'], 'model']]);
  }));

  // prettier-ignore
  it('emits cancel on completion if no items are recognized', marbles(m => {
    mockRecognize.mockImplementation(() => undefined);
    const values = {
      a: { position: 'a-pos' },
      A: { type: 'draw', position: 'a-pos', stroke: ['a-pos'] },
      s: {
        type: 'cancel',
        position: 'a-pos',
        stroke: ['a-pos'],
      }
    };
    const drag$ = m.hot('^-a-|', values);
    const expected$ = m.hot('^-A-(s|)', values);
    m
      .expect<unknown>(
        expertNavigation(
          drag$ as unknown as Observable<NavigationDrag>,
          'model' as unknown as MarkingMenuModelItem
        )
      )
      .toBeObservable(expected$);
    m.flush();
    expect(mockRecognize.mock.calls).toEqual([[['a-pos'], 'model']]);
  }));

  // prettier-ignore
  it('emits cancel on completion if the drag is empty', marbles(m => {
    const values = {
      c: { type: 'cancel' }
    };
    const drag$ = m.hot('^--|', values);
    const expected$ = m.hot('^--(c|)', values);
    m
      .expect<unknown>(
        expertNavigation(
          drag$ as unknown as Observable<NavigationDrag>,
          'model' as unknown as MarkingMenuModelItem
        )
      )
      .toBeObservable(expected$);
    m.flush();
    expect(mockRecognize).not.toHaveBeenCalled();
  }));

  // prettier-ignore
  it('cancels rather than selecting when the final drag notification is canceled', marbles(m => {
    mockRecognize.mockImplementation(() => 'selection');
    const values = {
      a: { position: 'a-pos' },
      c: { position: 'c-pos', canceled: true },
      A: { type: 'draw', position: 'a-pos', stroke: ['a-pos'] },
      C: { type: 'draw', position: 'c-pos', canceled: true, stroke: ['a-pos', 'c-pos'] },
      z: { type: 'cancel', position: 'c-pos', canceled: true, stroke: ['a-pos', 'c-pos'] }
    };
    const drag$ = m.hot('^-ac|', values);
    const expected$ = m.hot('^-AC(z|)', values);
    m
      .expect<unknown>(
        expertNavigation(
          drag$ as unknown as Observable<NavigationDrag>,
          'model' as unknown as MarkingMenuModelItem
        )
      )
      .toBeObservable(expected$);
    m.flush();
    expect(mockRecognize).not.toHaveBeenCalled();
  }));
});
