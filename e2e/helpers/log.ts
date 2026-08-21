import { expect, type Page } from '@playwright/test';

/**
 One line of the fixture's projected notification log (see
 `e2e/fixture/main.ts`): only the stable fields tests need, never raw pixel
 positions or timestamps.
 */
export type LogEntry = {
  type: string;
  mode: string;
  position: readonly [number, number];
  selectionId?: string;
  activeId?: string;
  menuId?: string;
};

const parseLog = (text: string): LogEntry[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as LogEntry);

/**
Read every notification the fixture has logged so far.
*/
export const readLog = async (page: Page): Promise<LogEntry[]> =>
  parseLog(await page.locator('#log').innerText());

/**
 Poll the log until an entry matches `isMatch`, then return the log as it
 stood at that point. Polling (rather than a fixed sleep) is what lets tests
 wait on the observable's actual output instead of guessing a duration.
 */
export const waitForLogEntry = async (
  page: Page,
  isMatch: (entry: LogEntry) => boolean,
): Promise<LogEntry[]> => {
  let log: LogEntry[] = [];
  await expect
    .poll(async () => {
      log = await readLog(page);
      return log.some((entry) => isMatch(entry));
    })
    .toBe(true);
  return log;
};

/**
 Poll the log until it holds more than `minLength` entries, then return it
 as it stood at that point. For a gesture run after one already logged a
 matching entry (a repeated `select`, say), `waitForLogEntry` would resolve
 on that stale entry immediately; waiting on growth instead targets the
 entries the next gesture actually appends.
 */
export const waitForLogGrowth = async (
  page: Page,
  minLength: number,
): Promise<LogEntry[]> => {
  let log: LogEntry[] = [];
  await expect
    .poll(async () => {
      log = await readLog(page);
      return log.length > minLength;
    })
    .toBe(true);
  return log;
};
