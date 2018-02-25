import 'rxjs'; // Required for some operators to be patched.
import { marbles } from 'rxjs-marbles';
import expertNavigation from './expert-navigation';
import recognize from '../recognizer';

jest.mock('../recognizer');

afterEach(() => {
  jest.resetAllMocks();
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
      .expect(expertNavigation(drag$, 'model', ['i-pos', 'j-pos']))
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
    m.expect(expertNavigation(drag$, 'model')).toBeObservable(expected$);
  }));

  // prettier-ignore
  it('emits select on completion if an item is recognized', marbles(m => {
    recognize.mockImplementation(() => 'selection');
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
    m.expect(expertNavigation(drag$, 'model')).toBeObservable(expected$);
    m.flush();
    expect(recognize.mock.calls).toEqual([[['a-pos'], 'model']]);
  }));

  // prettier-ignore
  it('emits cancel on completion if no items are recognized', marbles(m => {
    recognize.mockImplementation(() => undefined);
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
    m.expect(expertNavigation(drag$, 'model')).toBeObservable(expected$);
    m.flush();
    expect(recognize.mock.calls).toEqual([[['a-pos'], 'model']]);
  }));
});
