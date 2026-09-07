import type { Config } from 'prettier';

const config: Config = {
  singleQuote: true,
  // `prettier-plugin-tailwindcss` must come last: it wraps whatever other
  // plugins are loaded.
  plugins: [
    '@ianvs/prettier-plugin-sort-imports',
    'prettier-plugin-tailwindcss',
  ],
  // Where Tailwind's own classes are defined, so the sorter also knows the
  // ones `demo/playground/styles.css` adds with `@utility`.
  tailwindStylesheet: './demo/playground/styles.css',
  importOrder: ['<BUILTIN_MODULES>', '<THIRD_PARTY_MODULES>', '^[.]'],
  importOrderCaseSensitive: false,
};

export default config;
