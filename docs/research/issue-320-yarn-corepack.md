# Issue #320: Yarn, Corepack, Renovate, and release-job investigation

## Decision

Use Corepack with a project-level Yarn pin, not a checked-in Yarn executable:

```json
{
  "packageManager": "yarn@4.18.0+sha224.5707fce90df5d8720fae4e85a07ab55e90aa20fded8914893e2ba225"
}
```

Remove `yarnPath` and `.yarn/releases/yarn-4.18.0.cjs`. Yarn documents this as its normal configuration: `yarn set version` writes only `packageManager` by default, and adds a local release plus `yarnPath` only when the version cannot be represented by Corepack, `yarnPath` already exists, or `--yarn-path` is requested. A normal 4.18.0 release needs none of those exceptions. [Yarn: `set version`](https://yarnpkg.com/cli/set/version) [Yarn: `yarnPath`](https://yarnpkg.com/configuration/yarnrc#yarnPath)

The hash is optional but strongly recommended by Corepack. It is the Yarn 4.18.0 SHA-224 pin used by Corepack's own current manifest. [Corepack authoring guidance](https://github.com/nodejs/corepack/blob/main/README.md#when-authoring-packages) [Corepack 0.36.0 manifest](https://raw.githubusercontent.com/nodejs/corepack/main/package.json)

## Why this is the supported configuration

`packageManager` is the project contract for the Yarn version; Yarn says Corepack and similar tools use it to select Yarn. It is not merely informational. [Yarn manifest reference](https://yarnpkg.com/configuration/manifest#packageManager)

Conversely, `yarnPath` tells an already-running Yarn to replace itself with the binary in the repository. Yarn now recommends Corepack in most cases. [Yarn configuration reference](https://yarnpkg.com/configuration/yarnrc#yarnPath)

Keeping both fields is technically functional but counterproductive here:

- Renovate sees `packageManager` and, by design, uses Corepack to install Yarn.
- The resulting Yarn invocation sees `yarnPath` and switches to the checked-in binary.
- Therefore Renovate still has to perform the Corepack download that #286 could not complete, then does not use the downloaded executable. It preserves neither the simple Corepack path nor the intended benefit of the vendored path.

This follows both Yarn's documented delegation behavior and Renovate's documented Yarn version selection. [Yarn: `set version`](https://yarnpkg.com/cli/set/version) [Renovate npm/Yarn manager](https://docs.renovatebot.com/modules/manager/npm/#version-selection--installation)

The vendored binary was added specifically as a workaround for Renovate pull request #286, whose artifact-update log stopped at Corepack's attempt to download Yarn 4.18.0. It was not required by GitHub Actions or Changesets. [#286 artifact failure](https://github.com/QuentinRoy/Marking-Menu/pull/286#issuecomment-5616796146) [vendoring commit](https://github.com/QuentinRoy/Marking-Menu/commit/27f6ec724ecc150b7592babb98825f794a4064ca)

## Corepack bootstrap for Node 26

The repository fixes Node at 26.8.1. Node stopped distributing Corepack starting with Node 25, so a userland Corepack bootstrap is justified in local setup and GitHub Actions. [Node Corepack documentation](https://nodejs.org/download/release/v25.8.0/docs/api/corepack.html) [repository tool version](../../.tool-versions)

Use one pinned bootstrap command before the first `yarn` command:

```sh
npm install --global corepack@0.36.0
```

Corepack 0.36.0 supports Node 26 and exposes `yarn` and `yarnpkg` binaries as part of its npm package. That makes a separate `corepack enable` step unnecessary after this global npm installation; adding it is harmless but does not fix the current incorrect Yarn-1 fallback. [Corepack package manifest](https://raw.githubusercontent.com/nodejs/corepack/main/package.json)

For Node 14.19 through 24, the Corepack bundled with Node instead needs `corepack enable` to create its shims. [Corepack installation and enablement](https://github.com/nodejs/corepack/blob/main/README.md#how-to-install)

## Migration

Before this change, the shared setup action installed an unpinned Corepack. With no `packageManager`, its first `yarn` call selected fallback Yarn 1.22.22, which then handed off to the repository's `yarnPath` and finally ran Yarn 4.18.0. The release log shows all three stages. [failed release run 34682655051](https://github.com/QuentinRoy/Marking-Menu/actions/runs/34682655051)

This migration makes Corepack select Yarn 4.18.0 directly:

1. Adds the hashed `packageManager` value above.
2. Removes `yarnPath`, the checked-in release binary, and its ignore and formatter exceptions.
3. Pins the Node-26 bootstrap to `corepack@0.36.0` without adding a separate global Yarn install.
4. Removes the temporary Changesets workaround: `.changeset/config.json`'s `format: false`, the `changeset:version` script that formats explicitly, and the release action's `version:` override. [formatting workaround](https://github.com/QuentinRoy/Marking-Menu/commit/075c3a74cb678ffdb8909381a37201234808d779)
5. Upgrades `changesets/action` to its Changesets-3-compatible v2 release and checks out complete history for its Git operations.

A Renovate dependency pull request still needs a retry. Renovate officially supports the standard Corepack configuration, but #286 proves the hosted service then failed its Corepack download. If that exact hosted-service failure persists, use a documented temporary vendored fallback instead of combining `packageManager` and `yarnPath`.

## Release-job failures: relationship to Yarn

There have been three failed release runs since vendoring, but they have two different causes.

| Run                                                                                | Evidence                                                                                                                                                                               | Assessment                                                                                                                                                                         |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [34470412788](https://github.com/QuentinRoy/Marking-Menu/actions/runs/34470412788) | Changesets invoked `yarn exec prettier -- --write ...` and exited 2. This followed the removal of `packageManager`, which made Changesets' detector treat the project as Yarn Classic. | Related to the vendoring migration's removal of the standard pin, not to Yarn 4.18.0 itself. The restored pin allows this migration to remove the temporary formatting workaround. |
| [34522850669](https://github.com/QuentinRoy/Marking-Menu/actions/runs/34522850669) | `yarn install --immutable` completed as Yarn 4.18.0. The later `yarn changeset:version` failed in `@changesets/git` with `fatal: shallow file has changed since we read it`.           | Not a Yarn or Corepack failure.                                                                                                                                                    |
| [34682655051](https://github.com/QuentinRoy/Marking-Menu/actions/runs/34682655051) | Again, Yarn 4.18.0 installed successfully; the same later Changesets Git error occurred.                                                                                               | Not a Yarn or Corepack failure.                                                                                                                                                    |

The last two failures are a separate release-workflow problem. `actions/checkout` fetches one commit by default; its documentation specifies `fetch-depth: 0` for complete history. This migration uses a complete checkout before Changesets reads Git history. [checkout defaults](https://github.com/actions/checkout#fetch-all-history-for-all-tags-and-branches) [current release workflow](../../.github/workflows/release.yml)

This repository also used Changesets CLI 3.x with `changesets/action` v1. The action maintainers state that v2 is compatible with Changesets v3 and v1 is for Changesets v2, so this migration uses v2 and its current input names. [Changesets Action compatibility](https://github.com/changesets/action/blob/main/README.md)

## Validation criteria

- A clean Node-26 environment can install the pinned Corepack and `yarn --version` returns 4.18.0 without a `.yarn/releases` file.
- `yarn install --immutable`, tests, and `yarn changeset:version` succeed locally.
- A GitHub Actions release run completes the dependency setup without a Yarn-1 Corepack fallback.
- A retried Renovate dependency update regenerates `yarn.lock` successfully. If it cannot, capture the full Renovate artifact log before choosing the temporary vendored fallback.
- A release run with complete checkout history is compared with the two shallow-clone failures before attributing further errors to Changesets or GitHub Actions.
