// Applies the saved theme before first paint (a file, so the CSP can forbid inline scripts).
try {
  var t = localStorage.getItem('sg-theme');
  var ok = ['light', 'dark', 'solarized-light', 'solarized-dark', 'gruvbox-light', 'gruvbox-dark', 'nord', 'dracula', 'sage', 'volt',
    'wada-indigo', 'wada-ivory', 'wada-tyrian', 'wada-glaucous', 'wada-naples', 'wada-olive', 'kanagawa', 'lotus'];
  if (ok.indexOf(t) >= 0) document.documentElement.setAttribute('data-theme', t);
} catch (e) {}

// Right after a release, a page can arrive a few seconds before its build files do. If the app's own script or
// stylesheet fails to load, try again shortly (up to three times) instead of leaving a blank screen.
addEventListener('error', function (e) {
  var t = e.target, u = (t && (t.src || t.href)) || '';
  if (!/\/assets\//.test(u)) return;
  var n = 0;
  try { n = +sessionStorage.getItem('sg-retry') || 0; sessionStorage.setItem('sg-retry', n + 1); } catch (x) { n = 3; }
  if (n < 3) setTimeout(function () { location.reload(); }, 1500 * (n + 1));
}, true);
