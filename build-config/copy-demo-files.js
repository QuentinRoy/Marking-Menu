const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const copyFile = promisify(fs.copyFile);

const TARGET_DIR = '../docs/vendors';
const FILES_TO_COPY = [
  '../marking-menu.js',
  '../marking-menu.js.map',
  '../marking-menu.css',
  '../node_modules/rxjs/dist/bundles/rxjs.umd.js',
];

// Create the target directory if it does not exits.
if (!fs.existsSync(path.resolve(__dirname, TARGET_DIR))) {
  fs.mkdirSync(path.resolve(__dirname, TARGET_DIR));
}

// Copy all files.
Promise.all(
  FILES_TO_COPY.map(async (filePath) => {
    try {
      await copyFile(
        path.resolve(__dirname, filePath),
        path.resolve(__dirname, TARGET_DIR, path.basename(filePath))
      );
      // eslint-disable-next-line no-console
      console.log(
        `\u2713 ${filePath} → ${path.join(TARGET_DIR, path.basename(filePath))}`
      );
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('\u2717', error.message);
      return false;
    }
  })
).then(
  (results) => {
    if (results.some((success) => !success)) process.exit(1);
  },
  (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  }
);
