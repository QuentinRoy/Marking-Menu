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

const options = { movementsThreshold: 5, noviceDwellingTime: 300 };
const environment = { model };
const idle: NavigationState<typeof model> = {
  phase: 'idle',
  nextTimerToken: 0,
};

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

    expect(up.state).toEqual({ phase: 'idle', nextTimerToken: 1 });
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

    expect(up.state).toEqual({ phase: 'idle', nextTimerToken: 1 });
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

    expect(up.state).toEqual({ phase: 'idle', nextTimerToken: 1 });
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

    expect(canceled.state).toEqual({ phase: 'idle', nextTimerToken: 1 });
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

    expect(canceled.state).toEqual({ phase: 'idle', nextTimerToken: 1 });
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

  it('dispatches start as the very first command a gesture ever produces', () => {
    const down = transition(
      idle,
      { type: 'pointer.down', position: [0, 0] },
      environment,
      options,
    );

    expect(down.commands[0]).toMatchObject({
      type: 'dispatch',
      event: { type: 'start' },
    });
  });

  describe('startup dwelling into novice mode (objective 12)', () => {
    it('opens novice mode at the gesture origin when the mode-dwell timer elapses without significant movement', () => {
      const down = transition(
        idle,
        { type: 'pointer.down', position: [0, 0] },
        environment,
        options,
      );
      expect(down.state.phase).toBe('startup');
      // The armed timer's token, asserted once here so every later use of
      // the literal `0` below is justified.
      expect(down.state.phase === 'startup' && down.state.timer).toEqual({
        kind: 'mode-dwell',
        token: 0,
      });

      const move = transition(
        down.state,
        { type: 'pointer.move', position: [1, 0] },
        environment,
        options,
      );

      const elapsed = transition(
        move.state,
        { type: 'timer.elapsed', kind: 'mode-dwell', token: 0 },
        environment,
        options,
      );

      expect(elapsed.state).toEqual({
        phase: 'novice',
        menu: model,
        menuCenter: [0, 0],
        upperStroke: [[0, 0]],
        lowerStroke: [
          [0, 0],
          [1, 0],
        ],
        nextTimerToken: 1,
      });

      const command = dispatched(elapsed.commands);
      expect(command?.type === 'dispatch' && command.event.type).toBe('open');
      const event =
        command?.type === 'dispatch' && command.event.type === 'open'
          ? command.event
          : undefined;
      expect(event?.mode).toBe('novice');
      expect(event?.menu).toBe(model);
      expect(event?.menuCenter).toEqual([0, 0]);
      // The position is the last committed one, despite `timer.elapsed`
      // itself carrying no position of its own.
      expect(event?.position).toEqual([1, 0]);
    });

    it('crossing movementsThreshold cancels the mode-dwell timer and switches to expert instead, mutually exclusive with the dwell', () => {
      const down = transition(
        idle,
        { type: 'pointer.down', position: [0, 0] },
        environment,
        options,
      );
      expect(down.state.phase === 'startup' && down.state.timer).toEqual({
        kind: 'mode-dwell',
        token: 0,
      });

      const move = transition(
        down.state,
        { type: 'pointer.move', position: [100, 0] },
        environment,
        options,
      );

      expect(move.state.phase).toBe('expert');
      expect(move.commands).toEqual([
        { type: 'timer.cancel', kind: 'mode-dwell', token: 0 },
      ]);

      // The now-cancelled timer firing anyway is a no-op: expert owns no
      // timer, so the dwell can never open novice mode after the fact.
      const elapsed = transition(
        move.state,
        { type: 'timer.elapsed', kind: 'mode-dwell', token: 0 },
        environment,
        options,
      );
      expect(elapsed).toEqual({ state: move.state, commands: [] });
    });

    it('treats a timer.elapsed carrying a superseded token as a no-op at the machine level (objective 10)', () => {
      const startupState: NavigationState<typeof model> = {
        phase: 'startup',
        origin: [0, 0],
        stroke: [[0, 0]],
        timer: { kind: 'mode-dwell', token: 5 },
        nextTimerToken: 6,
      };

      const result = transition(
        startupState,
        { type: 'timer.elapsed', kind: 'mode-dwell', token: 4 },
        environment,
        options,
      );

      expect(result).toEqual({ state: startupState, commands: [] });
    });
  });

  describe('novice phase (minimal: hit-testing is not implemented yet)', () => {
    const noviceState: NavigationState<typeof model> = {
      phase: 'novice',
      menu: model,
      menuCenter: [0, 0],
      upperStroke: [[0, 0]],
      lowerStroke: [[0, 0]],
      nextTimerToken: 1,
    };

    it('cancels on pointer up, carrying the currently open menu and no active item', () => {
      const up = transition(
        noviceState,
        { type: 'pointer.up', position: [0, 0] },
        environment,
        options,
      );

      expect(up.state).toEqual({ phase: 'idle', nextTimerToken: 1 });
      const command = dispatched(up.commands);
      expect(command?.type === 'dispatch' && command.event.type).toBe('cancel');
      const event =
        command?.type === 'dispatch' && command.event.type === 'cancel'
          ? command.event
          : undefined;
      expect(event?.active).toBeNull();
      expect(event?.menu).toBe(model);
      expect(event?.mode).toBe('novice');
      expect(mockRecognize).not.toHaveBeenCalled();
    });

    it('cancels on pointer cancel the same way as pointer up', () => {
      const canceled = transition(
        noviceState,
        { type: 'pointer.cancel', position: [0, 0] },
        environment,
        options,
      );

      const command = dispatched(canceled.commands);
      expect(command?.type === 'dispatch' && command.event.type).toBe('cancel');
    });

    it('ignores pointer.down, pointer.move, and a stray timer.elapsed', () => {
      const inputs = [
        { type: 'pointer.down', position: [1, 1] },
        { type: 'pointer.move', position: [1, 1] },
        { type: 'timer.elapsed', kind: 'mode-dwell', token: 0 },
      ] as const;

      for (const input of inputs) {
        expect(transition(noviceState, input, environment, options)).toEqual({
          state: noviceState,
          commands: [],
        });
      }
    });
  });
});
