import { createModel } from '../model.js';
import { transition, type NavigationState } from './machine.js';

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
    const dispatched = up.commands.find((c) => c.type === 'dispatch');
    expect(dispatched?.type === 'dispatch' && dispatched.event.type).toBe(
      'select',
    );
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

  it('does not select on an unrecognized (zero-length) gesture', () => {
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

    expect(up).toEqual({ state: { phase: 'idle' }, commands: [] });
  });
});
