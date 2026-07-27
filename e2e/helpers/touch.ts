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
