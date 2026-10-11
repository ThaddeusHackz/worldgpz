import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4178', headless: true, viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'node server/src/index.js',
    url: 'http://127.0.0.1:4178/api/health',
    timeout: 30_000,
    reuseExistingServer: false,
    env: { PORT: '4178', NODE_ENV: 'production', DATABASE_URL: '', ADMIN_EMAIL: '', ADMIN_PASSWORD: '', ADMIN_PASSWORD_HASH: '', JWT_SECRET: '', AI_API_KEY: '', OPENAI_API_KEY: '', OPENROUTER_API_KEY: '', TAVILY_API_KEY: '' },
  },
});
