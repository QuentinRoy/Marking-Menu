# Separate the library and demo workspaces

The library is the only published package on the main branch. The demo is a private Yarn workspace with its own direct dependencies and build command, while the repository root runs shared checks. The demo depends on the library's built package. The one-time touch stroke collector stays on a temporary branch, retained by an archival tag at the version used for recording; its dependencies do not enter the permanent main-branch workspace. The corpus manifest cites that source revision.
