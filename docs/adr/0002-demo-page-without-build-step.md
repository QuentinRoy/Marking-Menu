# Demo page without a build step

The demo page (`packages/demo/index.html`) is plain HTML, CSS, and JavaScript with no build step. It loads the library's built `marking-menu.js` through an import map, the way a site without a bundler would, to show that the library works without one. The site build copies the page as is.

The page reads the library from `lib/`, which links into the demo's own `node_modules`. The demo sets Yarn's `hoistingLimits` to `workspaces` so that folder exists and the demo never reaches outside its package.

The playground is a React app and is built with Vite. It leaves `marking-menu` external and resolves it through its own import map to the same `lib/marking-menu.js`, so both pages run the same file.
