/*
 Typechecks smoke-test/check.ts against the package as it will actually be
 published: only the files package.json's `files` field ships, resolved
 through node_modules by package name (not a relative import into src/ or
 dist/). This is what catches exports/types-field mistakes that a plain
 `tsc` run against the source tree never would.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const smokeTestDir = path.join(root, 'smoke-test');
const packageDir = path.join(smokeTestDir, 'node_modules', 'marking-menu');

const pkg = JSON.parse(
  await readFile(path.join(root, 'package.json'), 'utf8'),
) as { files: string[] };

await rm(packageDir, { recursive: true, force: true });
await mkdir(packageDir, { recursive: true });
await Promise.all([
  cp(path.join(root, 'package.json'), path.join(packageDir, 'package.json')),
  ...pkg.files.map(async (file) =>
    cp(path.join(root, file), path.join(packageDir, file), {
      recursive: true,
    }),
  ),
]);

// `rxjs` is a peer dependency: link it in rather than making smoke-test/ its
// own installable project.
const rxjsLink = path.join(smokeTestDir, 'node_modules', 'rxjs');
if (!existsSync(rxjsLink)) {
  await symlink(path.join(root, 'node_modules', 'rxjs'), rxjsLink, 'dir');
}

const tsc = path.join(root, 'node_modules', '.bin', 'tsc');
const result = spawnSync(
  tsc,
  ['-p', path.join('smoke-test', 'tsconfig.json'), '--noEmit'],
  {
    cwd: root,
    stdio: 'inherit',
  },
);

// eslint-disable-next-line unicorn/no-process-exit -- this is a CLI script.
process.exit(result.status ?? 1);
