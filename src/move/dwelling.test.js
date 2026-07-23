import { configure } from 'rxjs-marbles/jest';
import dwelling from './dwelling.js';
import longMove from './long-move.js';

const { marbles } = configure({ run: false });

vi.mock('./long-move');

afterEach(() => {
  vi.resetAllMocks();
});

describe('dwelling', () => {
  // prettier-ignore
  it('emits when no long movements happens for the given period of time', marbles(m => {
    const drag$     = m.hot('-a-b-cd---e-fg--hi--j-k--l---------m--|');
    const longMove$ = m.hot('----------e-----h---j-k--l---------m--|');
    const expected$ = m.hot('----b--------g-----i--------l---------|');
    longMove.mockImplementation(() => longMove$);

    m.expect(
      dwelling(drag$, 30, 50, m.scheduler)
    ).toBeObservable(expected$);

    expect(longMove.mock.calls).toEqual([[drag$, 50]]);
  }));
});
