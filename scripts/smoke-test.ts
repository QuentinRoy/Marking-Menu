/*
 Typechecks smoke-test/check.ts against the package as it will actually be
 published: packed with `yarn pack`, unpacked into the fixture's node_modules,
 and resolved by package name rather than by a relative path into src/ or
 dist/.

 This is the only check that reads the *emitted* declarations the way a
 consumer would. `publint` and `attw` verify that types resolve; they do not
 ask whether the types are correct, and the `*.test-d.ts` suites ask that of
 `src/`, so neither sees a regression introduced by the declaration emit.
 */
/* eslint-disable unicorn/no-process-exit -- this is a CLI script. */
import { spawnSync } from 'node:child_process';
import { mkdir, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'smoke-test');
const modules = path.join(fixture, 'node_modules');
const tarball = path.join(fixture, 'package.tgz');

/**
 Runs a command in the repo root and returns its exit status. `isQuiet`
 withholds the command's own output unless it fails, which keeps the setup
 steps from burying the typecheck results they exist to produce.
 */
function run(command: string, args: string[], isQuiet = false): number {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: isQuiet ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });
  const status = result.status ?? 1;
  if (isQuiet && status !== 0) {
    process.stderr.write(`${result.stdout ?? ''}${result.stderr ?? ''}`);
  }

  return status;
}

/** Runs a setup command in the repo root, aborting the script if it fails. */
function runOrExit(command: string, args: string[]): void {
  if (run(command, args, true) !== 0) {
    process.exit(1);
  }
}

// Pack rather than copying the `files` field by hand: the tarball is what npm
// would publish, implicit includes and excludes and all.
runOrExit('yarn', ['pack', '--out', tarball]);

const packageDir = path.join(modules, 'marking-menu');
await rm(modules, { recursive: true, force: true });
await mkdir(packageDir, { recursive: true });
runOrExit('tar', ['-xzf', tarball, '-C', packageDir, '--strip-components=1']);

// `rxjs` is a peer dependency, so a real consumer resolves its own copy.
await symlink(
  path.join(root, 'node_modules', 'rxjs'),
  path.join(modules, 'rxjs'),
  'dir',
);

// Check every resolution style rather than stopping at the first failure: a
// declaration bug can be invisible to one and fatal to the other, and seeing
// which modes broke is most of the diagnosis.
const tsc = path.join(root, 'node_modules', '.bin', 'tsc');
const failures = ['tsconfig.bundler.json', 'tsconfig.nodenext.json'].filter(
  (config) => {
    console.log(`\n--- smoke-test: ${config} ---`);
    return run(tsc, ['-p', path.join('smoke-test', config), '--noEmit']) !== 0;
  },
);

process.exit(failures.length > 0 ? 1 : 0);
