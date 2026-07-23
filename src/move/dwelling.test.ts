import { configure } from 'rxjs-marbles/jest';
import dwelling from './dwelling.js';
import longMove, { type DragNotification } from './long-move.js';

const { marbles } = configure({ run: false });

vi.mock('./long-move');

afterEach(() => {
  vi.resetAllMocks();
});

describe('dwelling', () => {
  // prettier-ignore
  it('emits when no long movements happens for the given period of time', marbles(m => {
    // The values only serve as tokens: longMove is mocked.
    const values: Record<string, DragNotification> = Object.fromEntries(
      [...'abcdefghijklm'].map((letter) => [
        letter,
        { position: [0, 0], type: 'move' },
      ]),
    );
    const drag$     = m.hot('-a-b-cd---e-fg--hi--j-k--l---------m--|', values);
    const longMove$ = m.hot('----------e-----h---j-k--l---------m--|', values);
    const expected$ = m.hot('----b--------g-----i--------l---------|', values);
    vi.mocked(longMove).mockReturnValue(longMove$);

    m.expect(
      dwelling(drag$, {
              delay: 30,
              movementsThreshold: 50,
              scheduler: m.scheduler,
            })
    ).toBeObservable(expected$);

    expect(vi.mocked(longMove).mock.calls).toEqual([[drag$, 50]]);
  }));
});
