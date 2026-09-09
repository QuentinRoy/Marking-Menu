/*
 PROTOTYPE — issue #284. Throwaway.

 Drives `index.html` in Chrome, Firefox and Safari and prints the numbers
 the ticket asks for. The page is standalone (open it and click the
 buttons); this script only automates the three engines and the pixel
 reading a human eye would otherwise do.

 Run with `yarn prototype:vector-stroke`.
*/
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type Page,
} from '@playwright/test';

const here = import.meta.dirname;
/* `?probe` hides the page's own chrome: see index.html. */
const pageUrl = `${pathToFileURL(path.join(here, 'index.html')).href}?probe`;

const ENGINES = [
  { name: 'chromium', launcher: chromium },
  { name: 'firefox', launcher: firefox },
  { name: 'webkit', launcher: webkit },
];

const STROKE_COUNT = Number(process.env.POINTS ?? 1200);
/* The timing sweep is the slow half; SKIP_PERF re-checks the rest in seconds. */
const SKIP_PERF = process.env.SKIP_PERF !== undefined;

type Rect = { x: number; y: number; width: number; height: number };

/* --------------------------------------------------------------------- */

/* Probe regions come back in stage coordinates; screenshots are clipped in
   page coordinates. */
async function stageOrigin(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const rect = document.querySelector('#stage')!.getBoundingClientRect();
    return { x: rect.x + window.scrollX, y: rect.y + window.scrollY };
  });
}

async function shoot(page: Page, region: Rect): Promise<string> {
  const origin = await stageOrigin(page);
  const buffer = await page.screenshot({
    /* Rounded: a fractional clip resamples, and two screenshots taken at
       different subpixel phases differ along every stroke edge. */
    clip: {
      x: Math.round(origin.x + region.x),
      y: Math.round(origin.y + region.y),
      width: region.width,
      height: region.height,
    },
  });
  return buffer.toString('base64');
}

/* Pixel reading happens inside a blank page of the same browser: a
   screenshot is a PNG, and every engine can already decode one. The decode
   is repeated in each probe rather than shared, because these bodies are
   serialized into the page and cannot close over anything here. */
async function inkStats(
  analyzer: Page,
  base64: string,
): Promise<{ ink: number; total: number; centre: string }> {
  return analyzer.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(image, 0, 0);
    const { data: pixels } = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );
    let ink = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 200) ink++;
    }

    /* Exact, not bucketed: the restack probe compares one surface's
       composited colour against the other's, and a bucket boundary between
       them would read as a difference that is not there. */
    const middle =
      (Math.floor(canvas.height / 2) * canvas.width +
        Math.floor(canvas.width / 2)) *
      4;
    return {
      ink,
      total: pixels.length / 4,
      centre: `${pixels[middle]},${pixels[middle + 1]},${pixels[middle + 2]}`,
    };
  }, base64);
}

/* A count alone cannot tell anti-aliasing apart from a different shape.
   Splitting the differing pixels by whether both images painted there does:
   `bothPainted` is the stroke's own edge, `onePainted` is one surface
   covering ground the other left blank. */
async function diffStats(
  analyzer: Page,
  a: string,
  b: string,
): Promise<{
  differing: number;
  total: number;
  maxDiff: number;
  bothPainted: number;
  onePainted: number;
  box: string;
}> {
  return analyzer.evaluate(
    async ([first, second]) => {
      const read = async (data: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d', { willReadFrequently: true })!;
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, canvas.width, canvas.height);
      };

      const [canvasImage, svgImage] = [await read(first), await read(second)];
      const isInk = (image: ImageData, i: number) =>
        Math.min(image.data[i], image.data[i + 1], image.data[i + 2]) < 200;
      let differing = 0;
      let maxDiff = 0;
      let bothPainted = 0;
      let onePainted = 0;
      const box = {
        left: Number.POSITIVE_INFINITY,
        top: Number.POSITIVE_INFINITY,
        right: -1,
        bottom: -1,
      };
      for (let i = 0; i < canvasImage.data.length; i += 4) {
        let delta = 0;
        for (let c = 0; c < 3; c++) {
          delta = Math.max(
            delta,
            Math.abs(canvasImage.data[i + c] - svgImage.data[i + c]),
          );
        }

        maxDiff = Math.max(maxDiff, delta);
        /* Anti-aliasing differs by a hair everywhere; only a real difference
         in what was painted moves a channel this far. */
        if (delta <= 32) continue;
        differing++;
        if (isInk(canvasImage, i) && isInk(svgImage, i)) bothPainted++;
        else onePainted++;
        const pixel = i / 4;
        const x = pixel % canvasImage.width;
        const y = Math.floor(pixel / canvasImage.width);
        box.left = Math.min(box.left, x);
        box.right = Math.max(box.right, x);
        box.top = Math.min(box.top, y);
        box.bottom = Math.max(box.bottom, y);
      }

      return {
        differing,
        total: canvasImage.data.length / 4,
        maxDiff,
        bothPainted,
        onePainted,
        box:
          box.right < 0
            ? 'none'
            : `${box.left},${box.top}-${box.right},${box.bottom} of ${canvasImage.width}x${canvasImage.height}`,
      };
    },
    [a, b] as const,
  );
}

async function probe<T>(
  page: Page,
  name: string,
  argument?: unknown,
): Promise<T> {
  return page.evaluate(
    async ([probeName, probeArgument]) =>
      (window as any).probes[probeName as string](probeArgument),
    [name, argument] as const,
  ) as Promise<T>;
}

/* --------------------------------------------------------------------- */

async function measure(name: string, browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto(pageUrl);
  const analyzer = await context.newPage();
  await analyzer.goto('about:blank');

  const results: Record<string, unknown> = {};
  results.info = await probe(page, 'info');

  /* 1. Overflow, and 3. containment. */
  const escapes = [];
  for (const [surface, strategy] of [
    ['svg', 'absolute'],
    ['canvas', 'absolute'],
    /* The three ways to take a canvas out of the parent's scroll extents,
       each tested for whether it still escapes and whether it still obeys
       the parent's clip. */
    ['canvas-window', 'clip-margin'],
    ['canvas-window', 'fixed'],
    ['canvas-window', 'popover'],
    ['svg', 'popover'],
  ] as const) {
    for (const overflow of ['visible', 'hidden']) {
      const layout = await probe<{ outside: Rect; inside: Rect }>(
        page,
        'paintEscape',
        { surface, overflow, strategy },
      );
      escapes.push({
        surface,
        strategy,
        overflow,
        outside: await inkStats(analyzer, await shoot(page, layout.outside)),
        inside: await inkStats(analyzer, await shoot(page, layout.inside)),
      });
    }
  }

  results.escapes = escapes;

  /* 2. Scroll area. */
  results.scrollArea = [];
  for (const [surface, strategy] of [
    ['svg', 'absolute'],
    ['canvas', 'absolute'],
    ['canvas-window', 'absolute'],
    ['canvas-window-anchored', 'absolute'],
    ['canvas-window', 'clip-margin'],
    ['canvas-window', 'fixed'],
    ['canvas-window', 'popover'],
  ] as const) {
    (results.scrollArea as unknown[]).push(
      await probe(page, 'scrollArea', { surface, strategy }),
    );
  }

  /* 6. Caps, joins, and the start marker. */
  const fidelity = [];
  for (const caseName of [
    'polyline',
    'zigzag',
    'two-point',
    'single-point',
    'start-marker',
  ]) {
    const canvasLayout = await probe<{ region: Rect }>(page, 'fidelity', {
      surface: 'canvas',
      caseName,
    });
    const canvasShot = await shoot(page, canvasLayout.region);
    const svgLayout = await probe<{ region: Rect }>(page, 'fidelity', {
      surface: 'svg',
      caseName,
    });
    const svgShot = await shoot(page, svgLayout.region);
    fidelity.push({
      caseName,
      diff: await diffStats(analyzer, canvasShot, svgShot),
      canvasInk: (await inkStats(analyzer, canvasShot)).ink,
      svgInk: (await inkStats(analyzer, svgShot)).ink,
    });
  }

  /* The `M x y L x y` spelling of a one-point stroke. */
  const dotCanvas = await probe<{ region: Rect }>(page, 'singlePointDot', {
    surface: 'canvas',
  });
  const dotCanvasShot = await shoot(page, dotCanvas.region);
  const dotSvg = await probe<{ region: Rect }>(page, 'singlePointDot', {
    surface: 'svg',
  });
  const dotSvgShot = await shoot(page, dotSvg.region);
  fidelity.push({
    caseName: 'single-point (M…L)',
    diff: await diffStats(analyzer, dotCanvasShot, dotSvgShot),
    canvasInk: (await inkStats(analyzer, dotCanvasShot)).ink,
    svgInk: (await inkStats(analyzer, dotSvgShot)).ink,
  });
  results.fidelity = fidelity;

  /* 8. Restacking siblings, without z-index. */
  const restacks = [];
  for (const surface of ['svg', 'canvas']) {
    for (const [order, fade, strategy] of [
      [['a', 'b', 'c'], false, 'absolute'],
      [['c', 'b', 'a'], false, 'absolute'],
      [['a', 'c', 'b'], false, 'absolute'],
      /* Several fading at once, the front-most among them: what
         createGestureFeedback actually does. */
      [['a', 'b', 'c'], true, 'absolute'],
      [['c', 'b', 'a'], true, 'absolute'],
      /* And the same order inside one top-layer element, which is where the
         menu and the strokes would live together. */
      [['a', 'b', 'c'], false, 'popover'],
      [['c', 'b', 'a'], false, 'popover'],
      [['a', 'b', 'c'], true, 'popover'],
    ] as const) {
      const layout = await probe<{
        sample: { x: number; y: number };
        expected: string | null;
      }>(page, 'restack', { surface, order, fade, strategy });
      const stats = await inkStats(
        analyzer,
        await shoot(page, {
          x: layout.sample.x - 4,
          y: layout.sample.y - 4,
          width: 8,
          height: 8,
        }),
      );
      restacks.push({
        surface,
        strategy,
        order: order.join(''),
        fade,
        expected: layout.expected,
        topColour: stats.centre,
      });
    }
  }

  results.restack = restacks;

  /* The `::part()` claim #269 would gain. */
  results.cssStyling = await probe(page, 'cssStyling');

  /* 7. What #279's growth rule costs. */
  results.growthCost = await probe(page, 'growthCost');

  /* 4 and 5. Per-frame cost, three ways: a real rAF run (does anything
     miss a frame?), a synchronous run (JS cost, above the timer floor),
     and the same run with the reparse forced. */
  /* The page owns the list; duplicating it here would let the two drift. */
  const variants = await page.evaluate(
    () => (globalThis as any).VARIANTS as string[],
  );

  if (SKIP_PERF) {
    await context.close();
    return { engine: name, ...results };
  }

  const frames = [];
  for (const variant of variants) {
    frames.push(
      await probe(page, 'frameCost', { variant, count: STROKE_COUNT }),
    );
  }

  results.frameCost = frames;

  const sync = [];
  for (const variant of variants) {
    for (const forceGeometry of [false, true]) {
      sync.push(
        await probe(page, 'scaling', {
          variant,
          counts: [200, STROKE_COUNT, 5000],
          forceGeometry,
        }),
      );
    }
  }

  results.syncCost = sync;

  /* Only the svg spellings, run long enough to separate a residual quadratic
     from a linear one. */
  results.asymptotics = await probe(page, 'asymptotics');

  await context.close();
  return { engine: name, ...results };
}

/* --------------------------------------------------------------------- */

const all = [];
for (const { name, launcher } of ENGINES) {
  process.stderr.write(`measuring ${name}…\n`);
  const browser = await launcher.launch();
  try {
    all.push(await measure(name, browser));
  } finally {
    await browser.close();
  }
}

const json = JSON.stringify(all, null, 2);
await writeFile(path.join(here, 'results.json'), json + '\n');
process.stdout.write(json + '\n');
process.stderr.write('wrote results.json\n');
