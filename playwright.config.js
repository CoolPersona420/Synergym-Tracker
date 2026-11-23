import { defineConfig, devices } from '@playwright/test';

/* lets tests route the service worker's own requests (sw.spec.js); other tests block service workers */
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';

/* Browser tests run against a production build with Supabase faked in the browser (tests/e2e/fake-supabase.js) */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  /* PW_CHROMIUM points at a Chromium already on the machine, when the pinned one isn't installed */
  use: { baseURL: 'http://localhost:4173', serviceWorkers: 'block', ...(process.env.PW_CHROMIUM ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } } : {}) },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }
  ],
  webServer: { command: 'npx vite build && npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: !process.env.CI, timeout: 120000 }
});
