// Applies the saved theme before first paint (a file, so the CSP can forbid inline scripts).
try {
  var t = localStorage.getItem('sg-theme');
  var ok = ['light', 'dark', 'solarized-light', 'solarized-dark', 'gruvbox-light', 'gruvbox-dark', 'nord', 'dracula', 'ocean', 'sage', 'volt'];
  if (ok.indexOf(t) >= 0) document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
