/*
 Typechecks smoke-test/check.ts against the package as it will actually be
 published: packed with `yarn pack` and installed into an isolated fixture
 by npm, then resolved through its node_modules by package name (not a
 relative import into src/ or dist/). Packing (rather than hand-copying
 `files`) picks up npm's implicit includes/excludes exactly as the real
 publish would. The fixture is then typechecked under both a bundler-style
 and a Node-style `moduleResolution`, since a `.d.ts` bug can be invisible
 to one and not the other.
 */
import { spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const smokeTestDir = path.join(root, 'smoke-test');
const tarballPath = path.join(smokeTestDir, 'package.tgz');

/** Runs a command, exiting the process immediately if it fails. */
function runOrExit(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) {
    // eslint-disable-next-line unicorn/no-process-exit -- this is a CLI script.
    process.exit(result.status ?? 1);
  }
}

await rm(tarballPath, { force: true });
runOrExit('yarn', ['pack', '--out', tarballPath], root);

await rm(path.join(smokeTestDir, 'node_modules'), {
  recursive: true,
  force: true,
});
runOrExit(
  'npm',
  [
    'install',
    '--no-audit',
    '--no-fund',
    '--no-package-lock',
    '--ignore-scripts',
  ],
  smokeTestDir,
);

const tsc = path.join(root, 'node_modules', '.bin', 'tsc');
const configs = ['tsconfig.bundler.json', 'tsconfig.nodenext.json'];

// Run every resolution mode rather than stopping at the first failure, so a
// single invocation reports everything that's broken.
let hasFailed = false;
for (const config of configs) {
  console.log(`\n--- smoke-test: ${config} ---`);
  const result = spawnSync(
    tsc,
    ['-p', path.join('smoke-test', config), '--noEmit'],
    { cwd: root, stdio: 'inherit' },
  );
  if (result.status !== 0) {
    hasFailed = true;
  }
}

// eslint-disable-next-line unicorn/no-process-exit -- this is a CLI script.
process.exit(hasFailed ? 1 : 0);
