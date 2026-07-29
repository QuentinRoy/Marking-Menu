import { createModel } from '../model.js';
import { recognizeMarkingMenuStroke } from '../recognizer/recognize-mm-stroke.js';
import type * as RecognizeModule from '../recognizer/recognize-mm-stroke.js';
import { transition, type NavigationState } from './machine.js';

// Wraps the real recognizer rather than replacing it: every existing test
// keeps exercising genuine recognition geometry, and only the tests that
// need a specific (or impossible-to-construct) outcome override it with
// `mockReturnValueOnce`/`mockImplementationOnce`.
vi.mock('../recognizer/recognize-mm-stroke.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RecognizeModule>();
  return {
    ...actual,
    recognizeMarkingMenuStroke: vi.fn(actual.recognizeMarkingMenuStroke),
  };
});

const mockRecognize = vi.mocked(recognizeMarkingMenuStroke);

afterEach(() => {
  mockRecognize.mockClear();
});

const model = createModel({
  items: [
    { id: 'right', label: 'Right' },
    { id: 'down', label: 'Down' },
    { id: 'left', label: 'Left' },
    { id: 'up', label: 'Up' },
  ],
});

const options = { movementsThreshold: 5 };
const environment = { model };
const idle: NavigationState = { phase: 'idle' };

/** Find the `dispatch` command among a transition's commands, if any. */
const dispatched = (commands: ReturnType<typeof transition>['commands']) =>
  commands.find((c) => c.type === 'dispatch');

/** Find the `feedback.show` command among a transition's commands, if any. */
const feedbackShown = (commands: ReturnType<typeof transition>['commands']) =>
  commands.find((c) => c.type === 'feedback.show');

describe('transition', () => {
  it('recognizes directly from startup on pointer up, without an intermediate move', () => {
    const down = transition(
      idle,
      { type: 'pointer.down', position: [0, 0] },
      environment,
      options,
    );
    const up = transition(
      down.state,
      { type: 'pointer.up', position: [100, 0] },
      environment,
      options,
    );

    expect(up.state).toEqual({ phase: 'idle' });
    const command = dispatched(up.commands);
    expect(command?.type === 'dispatch' && command.event.type).toBe('select');
  });

  it('stays in startup for movement below the threshold', () => {
    const down = transition(
      idle,
      { type: 'pointer.down', position: [0, 0] },
      environment,
      options,
    );
    const move = transition(
      down.state,
      { type: 'pointer.move', position: [1, 0] },
      environment,
      options,
    );

    expect(move.state.phase).toBe('startup');
    expect(move.commands).toEqual([]);
  });

  it('ignores a second pointer.down while a gesture is already in progress, in both startup and expert (the pointer source is the primary guard; the machine covers it defensively too)', () => {
    const down = transition(
      idle,
      { type: 'pointer.down', position: [0, 0] },
      environment,
      options,
    );
    const secondDownDuringStartup = transition(
      down.state,
      { type: 'pointer.down', position: [5, 5] },
      environment,
      options,
    );
    expect(secondDownDuringStartup).toEqual({
      state: down.state,
      commands: [],
    });

    const move = transition(
      down.state,
      { type: 'pointer.move', position: [100, 0] },
      environment,
      options,
    );
    const secondDownDuringExpert = transition(
      move.state,
      { type: 'pointer.down', position: [5, 5] },
      environment,
      options,
    );
    expect(secondDownDuringExpert).toEqual({ state: move.state, commands: [] });
  });

  it('ignores stray movement or release input while idle', () => {
    expect(
      transition(
        idle,
        { type: 'pointer.move', position: [1, 1] },
        environment,
        options,
      ),
    ).toEqual({ state: idle, commands: [] });
  });

  it('dispatches cancel, without attempting recognition, for a gesture with no movement at all', () => {
    const down = transition(
      idle,
      { type: 'pointer.down', position: [0, 0] },
      environment,
      options,
    );
    const up = transition(
      down.state,
      { type: 'pointer.up', position: [0, 0] },
      environment,
      options,
    );

    expect(up.state).toEqual({ phase: 'idle' });
    expect(mockRecognize).not.toHaveBeenCalled();

    const command = dispatched(up.commands);
    expect(command?.type === 'dispatch' && command.event.type).toBe('cancel');
    expect(
      command?.type === 'dispatch' &&
        command.event.type === 'cancel' &&
        command.event.active,
    ).toBeNull();
    expect(feedbackShown(up.commands)).toMatchObject({ canceled: true });
  });

  it('dispatches cancel for a completed gesture that recognition does not match', () => {
    mockRecognize.mockReturnValueOnce(null);

    const down = transition(
      idle,
      { type: 'pointer.down', position: [0, 0] },
      environment,
      options,
    );
    const move = transition(
      down.state,
      { type: 'pointer.move', position: [100, 0] },
      environment,
      options,
    );
    const up = transition(
      move.state,
      { type: 'pointer.up', position: [120, 0] },
      environment,
      options,
    );

    expect(up.state).toEqual({ phase: 'idle' });
    expect(mockRecognize).toHaveBeenCalledTimes(1);

    const command = dispatched(up.commands);
    expect(command?.type === 'dispatch' && command.event.type).toBe('cancel');
    expect(feedbackShown(up.commands)).toMatchObject({ canceled: true });
  });

  it('dispatches cancel, never select, when the pointer is cancelled mid-gesture, even though the stroke would otherwise have recognized', () => {
    const down = transition(
      idle,
      { type: 'pointer.down', position: [0, 0] },
      environment,
      options,
    );
    const move = transition(
      down.state,
      { type: 'pointer.move', position: [100, 0] },
      environment,
      options,
    );
    expect(move.state.phase).toBe('expert');

    const canceled = transition(
      move.state,
      { type: 'pointer.cancel', position: [100, 0] },
      environment,
      options,
    );

    expect(canceled.state).toEqual({ phase: 'idle' });
    expect(mockRecognize).not.toHaveBeenCalled();

    const command = dispatched(canceled.commands);
    expect(command?.type === 'dispatch' && command.event.type).toBe('cancel');
    expect(
      command?.type === 'dispatch' &&
        command.event.type === 'cancel' &&
        command.event.active,
    ).toBeNull();
    expect(feedbackShown(canceled.commands)).toMatchObject({ canceled: true });
  });

  it('dispatches cancel when the pointer is cancelled during startup, before any movement crossed the threshold', () => {
    const down = transition(
      idle,
      { type: 'pointer.down', position: [0, 0] },
      environment,
      options,
    );

    const canceled = transition(
      down.state,
      { type: 'pointer.cancel', position: [0, 0] },
      environment,
      options,
    );

    expect(canceled.state).toEqual({ phase: 'idle' });
    expect(mockRecognize).not.toHaveBeenCalled();
    const command = dispatched(canceled.commands);
    expect(command?.type === 'dispatch' && command.event.type).toBe('cancel');
  });

  it('ignores a stray pointer.cancel while idle', () => {
    expect(
      transition(
        idle,
        { type: 'pointer.cancel', position: [1, 1] },
        environment,
        options,
      ),
    ).toEqual({ state: idle, commands: [] });
  });
});
