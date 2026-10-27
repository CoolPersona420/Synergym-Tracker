// Applies the saved theme before first paint (a file, so the CSP can forbid inline scripts), and points the
// Home Screen icon at the matching wolf.
try {
  var t = localStorage.getItem('sg-theme');
  var ok = ['light', 'dark', 'solarized-light', 'solarized-dark', 'gruvbox-light', 'gruvbox-dark', 'nord', 'dracula', 'ocean', 'sage', 'volt'];
  if (ok.indexOf(t) >= 0) document.documentElement.setAttribute('data-theme', t);
} catch (e) {}

// The app icon. A phone takes the icon from the page when the app is added to the Home Screen (iPhone) or
// installed (Android), so the page always offers the one that fits: by default it matches the app (its theme,
// or with Auto the phone's light or dark mode); Settings can fix it to light or dark. The app's own theme never
// changes with it. A link from Settings carries the icon into Safari, where iPhones add apps, as ?icon=<variant>.
(function () {
  var ICONS = ['light', 'dark', 'solarized-light', 'solarized-dark', 'gruvbox-light', 'gruvbox-dark', 'nord', 'dracula', 'ocean', 'sage', 'volt'];
  var dark = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  try {
    var q = new URLSearchParams(location.search), c = q.get('icon');
    if (c === 'app' || ICONS.indexOf(c) >= 0) {
      if (c === 'app') localStorage.removeItem('sg-icon'); else localStorage.setItem('sg-icon', c);
      q.delete('icon');
      history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    }
  } catch (e) {}
  function variant() {
    var c = null; try { c = localStorage.getItem('sg-icon'); } catch (e) {}
    if (ICONS.indexOf(c) >= 0) return c;
    var th = document.documentElement.getAttribute('data-theme');
    if (ICONS.indexOf(th) >= 0) return th;
    return dark && dark.matches ? 'dark' : 'light';
  }
  window.sgAppIcon = function () {
    var v = variant(), a = document.querySelector('link[rel="apple-touch-icon"]'), m = document.querySelector('link[rel="manifest"]');
    if (a && a.getAttribute('href') !== '/icons/' + v + '-180.png') a.setAttribute('href', '/icons/' + v + '-180.png');
    if (m && m.getAttribute('href') !== '/manifests/' + v + '.webmanifest') m.setAttribute('href', '/manifests/' + v + '.webmanifest');
    return v;
  };
  // the icon links come after this script in the page
  document.addEventListener('DOMContentLoaded', window.sgAppIcon);
  if (dark && dark.addEventListener) dark.addEventListener('change', window.sgAppIcon);
})();
