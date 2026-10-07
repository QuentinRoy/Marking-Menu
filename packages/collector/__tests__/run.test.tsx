import {
  TimelinePlayer,
  useLogger,
  useTask,
} from '@lightmill/react-experiment';
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { makeTimeline, type CollectorLog, type TrialTask } from '../model.ts';

// React 19 warns unless tests declare they drive updates through `act`.
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

function Task() {
  const { task, onTaskCompleted } = useTask('trial');
  const log = useLogger();
  return (
    <button
      type="button"
      onClick={() => {
        log({
          type: 'warmup',
          taskNumber: task.taskNumber,
          trialId: task.trialId,
        });
        onTaskCompleted();
      }}
    >
      {task.trialId}
    </button>
  );
}

const renderRun = (
  timeline: TrialTask[],
  resumeAfter?: { type: 'trial'; number: number },
) => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const logs: CollectorLog[] = [];
  let isCompleted = false;
  act(() => {
    // The collector renders under StrictMode, which runs effects twice.
    root.render(
      <StrictMode>
        <TimelinePlayer
          timeline={timeline}
          {...(resumeAfter && {
            resumeAfterTask: (task: TrialTask) =>
              task.type === resumeAfter.type &&
              task.taskNumber === resumeAfter.number,
          })}
          onLog={async (log) => {
            logs.push(log);
          }}
          onCompleted={() => {
            isCompleted = true;
          }}
          elements={{ tasks: { trial: <Task /> }, completed: <p>Done</p> }}
        />
      </StrictMode>,
    );
  });
  return {
    container,
    logs,
    isCompleted: () => isCompleted,
    async click() {
      const button = container.querySelector('button');
      if (!(button instanceof HTMLButtonElement)) {
        throw new TypeError('No task is showing.');
      }

      await act(async () => {
        button.click();
      });
    },
    [Symbol.dispose]() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

const timeline = makeTimeline(1).slice(0, 3);
const [first, second, third] = timeline;

test('TimelinePlayer walks a timeline on React 19', async () => {
  using run = renderRun(timeline);
  await expect.poll(() => run.container.textContent).toBe(first?.trialId);
  await run.click();
  await run.click();
  await run.click();
  await expect.poll(() => run.container.textContent).toBe('Done');
  expect(run.isCompleted()).toBe(true);
  expect(run.logs.map((log) => log.taskNumber)).toEqual([1, 2, 3]);
});

test('TimelinePlayer resumes after the given task on React 19', async () => {
  using run = renderRun(timeline, { type: 'trial', number: 1 });
  await expect.poll(() => run.container.textContent).toBe(second?.trialId);
  await run.click();
  await expect.poll(() => run.container.textContent).toBe(third?.trialId);
});
