import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { highlights } from './src/lib/whatsnew.js';

/* the app's version comes from package.json, so the app, error reports and releases always agree */
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/* version.json, published with each build: the version and what's new in it (from RELEASE_NOTES.md), for the
   update popup an older copy of the app shows when this one is out */
const versionFile = () => ({
  name: 'version-json',
  generateBundle() {
    let notes = []; try { notes = highlights(readFileSync(new URL('./RELEASE_NOTES.md', import.meta.url), 'utf8'), version); } catch { /* no notes: version only */ }
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version, notes }) });
  }
});

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [versionFile()]
});
