import { defineConfig, devices } from '@playwright/test';

/* Browser tests run against a production build with Supabase faked in the browser (tests/e2e/fake-supabase.js) */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173', serviceWorkers: 'block' },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }
  ],
  webServer: { command: 'npx vite build && npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: !process.env.CI, timeout: 120000 }
});
