const fs = require('fs');
const { resolve, basename, join } = require('path');

const TARGET_DIR = '../demo/vendors';
const FILES_TO_COPY = [
  '../marking-menu.js',
  '../marking-menu.css',
  '../marking-menu.js.map',
  '../node_modules/rxjs/bundles/rxjs.umd.js'
];

// Function adapted from https://stackoverflow.com/a/14387791/2212031
const copyFile = (source, target, cb) => {
  let cbCalled = false;

  const done = err => {
    if (!cbCalled) {
      cb(err);
      cbCalled = true;
    }
  };

  const rd = fs.createReadStream(source);
  rd.on('error', err => {
    done(err);
  });
  const wr = fs.createWriteStream(target);
  wr.on('error', err => {
    done(err);
  });
  wr.on('close', () => {
    done();
  });
  rd.pipe(wr);
};

// Create the demo/vendor directory if it does not exits.
if (!fs.existsSync(resolve(__dirname, TARGET_DIR))) {
  fs.mkdirSync(resolve(__dirname, TARGET_DIR));
}

FILES_TO_COPY.forEach(filePath =>
  copyFile(
    resolve(__dirname, filePath),
    resolve(__dirname, TARGET_DIR, basename(filePath)),
    err => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        process.exit(1);
      } else {
        // eslint-disable-next-line no-console
        console.log(`${filePath} → ${join(TARGET_DIR, basename(filePath))}`);
      }
    }
  )
);
