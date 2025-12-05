import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['script.js', 'utils.js'],
      exclude: ['node_modules', 'tests', '*.test.js']
    }
  }
});

