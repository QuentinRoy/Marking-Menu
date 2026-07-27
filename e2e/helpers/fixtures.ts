import { test as base, expect } from '@playwright/test';

/**
 The project's own `test`: every test gets a fresh page already navigated to
 the fixture, and fails if the page throws an uncaught error or logs a
 `console.error` during the test — a marking menu gesture pipeline that logs
 an error is a bug even when the assertions the test wrote happen to pass.
 */
export const test = base.extend({
  async page({ page }, use) {
    const pageErrors: Error[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    await page.goto('/');
    await use(page);

    expect(pageErrors, 'Expected no uncaught page errors').toHaveLength(0);
    expect(
      consoleErrors,
      'Expected no unexpected console.error calls',
    ).toHaveLength(0);
  },
});

export { expect } from '@playwright/test';
