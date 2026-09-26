import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

export const paths = {
  database: path.join(root, 'data', 'touch-v1.sqlite'),
  backups: path.join(root, 'data', 'backups'),
  corpus: path.join(root, 'data', 'corpus'),
  build: path.join(root, 'dist'),
};
