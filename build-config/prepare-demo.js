const { copyFile, cp, rm } = require('node:fs/promises');
const path = require('node:path');

const distDir = path.resolve(__dirname, '../dist');
const demoDir = path.resolve(__dirname, '../demo');
const distDemoDir = path.resolve(__dirname, '../dist-demo');
const libraryFiles = ['marking-menu.mjs', 'marking-menu.mjs.map'];

async function prepareDemo() {
  await rm(distDemoDir, { force: true, recursive: true });
  await cp(demoDir, distDemoDir, { recursive: true });
  await Promise.all(
    libraryFiles.map((file) =>
      copyFile(path.join(distDir, file), path.join(distDemoDir, file))
    )
  );
}

prepareDemo().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
