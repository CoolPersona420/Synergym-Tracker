import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

/* the app's version comes from package.json, so the app, error reports and releases always agree */
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) }
});
