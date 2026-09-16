import path from 'node:path';
import { defineConfig } from 'vite';

// A relative `vite preview --outDir ../demo-dist` mis-resolves (Vite treats
// an outDir outside its root as invalid), the same reason the fixture
// server above points at a config file instead of passing `--outDir`
// directly. This config exists only to hand `demo-dist` an absolute path
// and pin the same host/port the fixture server does.
export default defineConfig({
  build: { outDir: path.resolve(import.meta.dirname, '../demo-dist') },
  preview: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: true,
  },
});
