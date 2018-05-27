import { configure } from 'rxjs-marbles/jest';
import dwelling from './dwelling';
import longMove from './long-move';

const { marbles } = configure({ run: false });

jest.mock('./long-move');

afterEach(() => {
  jest.resetAllMocks();
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
