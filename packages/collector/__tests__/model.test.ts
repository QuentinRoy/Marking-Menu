import { makeTimeline } from '../model.ts';

test('a session number always yields the same timeline', () => {
  expect(makeTimeline(2)).toEqual(makeTimeline(2));
  expect(makeTimeline(2)).not.toEqual(makeTimeline(3));
});

test('task numbers count every task from 1, warm-ups included', () => {
  const timeline = makeTimeline(1);
  expect(timeline.map((task) => task.taskNumber)).toEqual(
    timeline.map((_, index) => index + 1),
  );
  expect(timeline.slice(0, 3).every((task) => task.warmup)).toBe(true);
  expect(new Set(timeline.map((task) => task.trialId)).size).toBe(
    timeline.length,
  );
});
