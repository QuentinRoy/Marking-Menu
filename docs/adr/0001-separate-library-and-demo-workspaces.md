# Separate the library and demo workspaces

The repository root is a private Yarn project for shared checks and release orchestration. The published `marking-menu` library and private `@marking-menu/demo` are separate workspaces. The demo declares a workspace dependency on the library and uses the built package through Yarn’s `node_modules` link. Root scripts build the library first, then the demo site, and run formatting, linting, type checking, tests, and publishing.

The library workspace contains the package manifest, source, build configuration, and the README and license that ship in its package. The collector stays on a temporary branch and does not enter the permanent workspace layout.
