import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals:     true,
    coverage: {
      provider:  'v8',
      reporter:  ['text', 'lcov'],
      include:   ['lib/**/*.ts'],
      exclude:   ['lib/products.ts', 'lib/stocksData.ts'], // fitxers de dades estàtiques
      thresholds: { lines: 60, functions: 60 },            // objectiu creixent cap a 80%
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
