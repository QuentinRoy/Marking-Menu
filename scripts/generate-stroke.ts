/*
 A small CLI around the test-only stroke generator (see
 `src/recognizer/__fixtures__/generate-stroke.ts`), for producing a wobbled
 stroke to look at or feed elsewhere without writing a test. Loaded through
 Vite's SSR module runner rather than plain `node` so the generator's own
 `../../utils.js`-style relative imports resolve the same way they do in the
 real build and in tests.

 Usage:
   node scripts/generate-stroke.ts --angles 270,45,90 > stroke.csv
 */
/* eslint-disable unicorn/no-process-exit -- this is a CLI script. */
import process from 'node:process';
import { parseArgs } from 'node:util';
import { createServer } from 'vite';
import type {
  generateStroke as GenerateStroke,
  Wobble,
} from '../src/recognizer/__fixtures__/generate-stroke.js';

type GenerateStrokeModule = {
  generateStroke: typeof GenerateStroke;
  CALIBRATED_WOBBLE: Wobble;
};

const { values } = parseArgs({
  options: {
    angles: { type: 'string' },
    seed: { type: 'string', default: '1' },
    'segment-length': { type: 'string' },
    'step-size': { type: 'string' },
    'heading-wander': { type: 'string' },
    'lateral-wander': { type: 'string' },
    wavelength: { type: 'string' },
    'corner-radius': { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});

if (values.help || values.angles === undefined) {
  console.log(
    [
      'Generate a wobbled marking-menu stroke and print it as CSV.',
      '',
      'Usage: node scripts/generate-stroke.ts --angles 270,45,90 [options] > stroke.csv',
      '',
      'Options:',
      '  --angles <deg,deg,...>   Required. One direction per menu level, in',
      '                           degrees, in the same convention as a model',
      "                           item's angle.",
      '  --seed <n>               Noise seed (default: 1).',
      '  --segment-length <px>    Length of each straight segment (default: 200).',
      '  --step-size <px>         Distance between generated points (default: 5).',
      '  --heading-wander <deg>   Wobble override: heading wander.',
      '  --lateral-wander <px>    Wobble override: lateral wander.',
      '  --wavelength <px>        Wobble override: wander wavelength.',
      '  --corner-radius <px>     Wobble override: corner easing radius.',
    ].join('\n'),
  );
  process.exit(values.help ? 0 : 1);
}

const angles = values.angles.split(',').map((angle) => {
  const parsed = Number(angle);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`Not a valid angle: "${angle}"`);
  }

  return parsed;
});

/**
 A single-entry `{ [key]: Number(raw) }`, or an empty object when `raw` is
 unset. Spreading the result only ever adds the key when the flag was
 actually passed, which is what every numeric CLI option below needs.
 */
const numberField = (
  key: string,
  raw: string | undefined,
): Record<string, number> => (raw === undefined ? {} : { [key]: Number(raw) });

const wobbleOverride = {
  ...numberField('headingWander', values['heading-wander']),
  ...numberField('lateralWander', values['lateral-wander']),
  ...numberField('wavelength', values.wavelength),
  ...numberField('cornerRadius', values['corner-radius']),
};

const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: 'custom',
});
try {
  // `ssrLoadModule` loads a module by URL rather than by a statically
  // analyzable specifier (hence the absolute, `.ts`-suffixed path below,
  // unlike the `.js`-suffixed relative import above), so its return type is
  // necessarily untyped; the shape asserted below is that of the module it
  // is actually pointed at.
  const { generateStroke, CALIBRATED_WOBBLE: calibratedWobble } =
    (await server.ssrLoadModule(
      '/src/recognizer/__fixtures__/generate-stroke.ts',
    )) as GenerateStrokeModule;
  const stroke = generateStroke({
    angles,
    seed: Number(values.seed),
    wobble: { ...calibratedWobble, ...wobbleOverride },
    ...numberField('segmentLength', values['segment-length']),
    ...numberField('stepSize', values['step-size']),
  });

  console.log('type,x,y,timeStamp,device');
  for (const [index, [x, y]] of stroke.entries()) {
    const type =
      index === 0 ? 'start' : index === stroke.length - 1 ? 'end' : 'move';
    console.log(
      `${type},${x.toFixed(2)},${y.toFixed(2)},${index * 10},generated`,
    );
  }
} finally {
  await server.close();
}
