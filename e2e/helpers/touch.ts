import type { CDPSession, Page } from '@playwright/test';
import type { Point } from './gestures.js';

/**
 A single-finger touch drag driven directly through the Chromium DevTools
 Protocol (`Input.dispatchTouchEvent`), rather than Playwright's own
 `touchscreen` API: the CDP call produces native touch input the browser
 turns into real `pointerType: "touch"` pointer events (capture,
 `touch-action`, coalescing and all), which is what the library's pointer
 event pipeline (`src/move/pointer-drag.ts`) actually needs exercised.
 Chromium-only, hence this project's dedicated `chromium-touch` Playwright
 project.
 */
export class CdpTouchDrag {
  static async start(page: Page, at: Point): Promise<CdpTouchDrag> {
    const client = await page.context().newCDPSession(page);
    const drag = new CdpTouchDrag(client);
    await drag.#dispatch('touchStart', at);
    return drag;
  }

  readonly #client: CDPSession;

  private constructor(client: CDPSession) {
    this.#client = client;
  }

  async #dispatch(type: 'touchMove' | 'touchStart', at: Point): Promise<void> {
    await this.#client.send('Input.dispatchTouchEvent', {
      touchPoints: [{ x: at.x, y: at.y }],
      type,
    });
  }

  async moveTo(at: Point): Promise<void> {
    await this.#dispatch('touchMove', at);
  }

  async end(): Promise<void> {
    await this.#client.send('Input.dispatchTouchEvent', {
      touchPoints: [],
      type: 'touchEnd',
    });
    await this.#client.detach();
  }
}

/**
 A multi-finger touch driven through CDP, for scenarios that need genuine
 concurrent pointer ids rather than a single drag. The primary finger (id 0)
 is the one Pointer Events reports as `isPrimary`; any number of other
 fingers (ids 1, 2, ...) can be added, moved and lifted independently while
 the primary stays down, the same way real extra touch contacts behave.

 `Input.dispatchTouchEvent` takes `touchPoints` differently depending on
 `type`: `touchStart`/`touchMove` want every currently active point (a
 point missing from the list is otherwise untouched, so this always sends
 every finger's full current positions), but `touchEnd` wants only the
 point(s) *ending* in that event — sending a still-down finger there too
 (as if it were the "remaining active set") ends it as well, which is not
 what "lift one finger, keep the others down" means.

 Disposal (closing the underlying CDP session) is kept separate from ending
 the primary — rather than folded into it, the way `CdpTouchDrag.end` does
 for its single point — so a test can end the primary and keep driving
 other fingers afterward, e.g. lifting a decoy that outlives the gesture it
 was a decoy for. It's exposed as `Symbol.asyncDispose` so callers open it
 with `await using` instead of a manual try/finally.
 */
export class CdpMultiTouchDrag {
  static async start(page: Page, primaryAt: Point): Promise<CdpMultiTouchDrag> {
    const client = await page.context().newCDPSession(page);
    const drag = new CdpMultiTouchDrag(client);
    drag.#points.set(0, primaryAt);
    await drag.#dispatchActive('touchStart');
    return drag;
  }

  readonly #client: CDPSession;
  readonly #points = new Map<number, Point>();

  private constructor(client: CDPSession) {
    this.#client = client;
  }

  async #dispatchActive(type: 'touchMove' | 'touchStart'): Promise<void> {
    const touchPoints: Array<{ id: number; x: number; y: number }> = [];
    for (const [id, { x, y }] of this.#points) {
      touchPoints.push({ id, x, y });
    }

    await this.#client.send('Input.dispatchTouchEvent', { touchPoints, type });
  }

  async #dispatchEnd(ids: readonly number[]): Promise<void> {
    await this.#client.send('Input.dispatchTouchEvent', {
      touchPoints: ids.map((id) => {
        const point = this.#points.get(id);
        if (!point) {
          throw new TypeError(`No active touch point with id ${id}.`);
        }

        return { id, x: point.x, y: point.y };
      }),
      type: 'touchEnd',
    });
    for (const id of ids) {
      this.#points.delete(id);
    }
  }

  /**
  Touch a non-primary finger down. `id` must be neither 0 nor already active.
  */
  async addFinger(id: number, at: Point): Promise<void> {
    this.#points.set(id, at);
    await this.#dispatchActive('touchStart');
  }

  async moveFinger(id: number, at: Point): Promise<void> {
    this.#points.set(id, at);
    await this.#dispatchActive('touchMove');
  }

  async liftFinger(id: number): Promise<void> {
    await this.#dispatchEnd([id]);
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.#client.detach();
  }
}
