# Separate the library and demo workspaces

The repository root is a private Yarn project for shared checks and release orchestration. The published `marking-menu` library and private `@marking-menu/demo` are separate workspaces. The demo declares a workspace dependency on the library and uses the built package through Yarn’s `node_modules` link. Root scripts build the library first, then the demo site, and run formatting, linting, type checking, tests, and publishing.

The library workspace contains the package manifest, source, build configuration, `README.md`, `CHANGELOG.md`, and `LICENSE`. The repository root links to the package's README, so there is one document to maintain. Keeping the root private separates release orchestration from the published package. The demo owns its React and editor dependencies and reads the library's emitted files through Yarn's workspace link, so its build exercises the package that consumers receive.
