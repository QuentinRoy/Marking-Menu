import { marbles } from 'rxjs-marbles';
import { dist } from '../utils';
import longMove from './long-move';

jest.mock('../utils');

afterEach(() => {
  jest.resetAllMocks();
});

describe('longMove', () => {
  const values = {
    a: { position: 5, type: 'move' },
    b: { position: 10, type: 'move' },
    x: { position: 50, type: 'move' },
    y: { position: 20, type: 'move' },
    e: { position: 50, type: 'end' },
  };

  // prettier-ignore
  it('it filters out movements smaller than its threshold', marbles(m => {
      // Mock distance from current with current's value.
      dist.mockImplementation((prev, cur) => cur);

      const drag$     = m.hot('^a-ba--b-xbaa--by-aa--x-b(e|)', values);
      const expected$ = m.hot('^--------x------y-----x--|',    values);
      m.expect(longMove(drag$, 20)).toBeObservable(expected$);
  }));

  // prettier-ignore
  it('the threshold is null by default (i.e. almost everything goes through)', marbles(m => {
    // Mock distance from current with current's value.
    dist.mockImplementation((prev, cur) => cur);

    const drag$     = m.hot('^a-ba--b-xbaa--by-aa--x-b(e|)', values);
    const expected$ = m.hot('^--ba--b-xbaa--by-aa--x-b|',    values);
    m.expect(longMove(drag$)).toBeObservable(expected$);
  }));
});
