/* What's new in a version, for the update popup: the bold titles of the first few bullets of its section in
   RELEASE_NOTES.md ("- **Edit on every finished session (issue #3):** …" gives "Edit on every finished session").
   Used when the app is built (vite.config.js writes them to version.json); nothing to keep up by hand. */
export function highlights(notes, version, max = 3) {
  const lines = String(notes || '').split('\n'), v = String(version || '');
  const start = lines.findIndex(l => l.startsWith('## ') && l.slice(3).trim().split(/\s/)[0] === v);
  if (start < 0) return [];
  const out = [];
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('## ') && out.length < max; i++) {
    const m = /^- \*\*(.+?)\*\*/.exec(lines[i]); if (!m) continue;
    const t = m[1].replace(/:$/, '').replace(/\s*\((issues? )?#\d+(,? (and )?#\d+)*\)\s*$/i, '').trim();
    if (t) out.push(t.slice(0, 80));
  }
  return out;
}
