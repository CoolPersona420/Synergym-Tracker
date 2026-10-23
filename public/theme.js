// Applies the saved theme before first paint (kept as a file so the CSP can forbid inline scripts).
try { var t = localStorage.getItem('sg-theme'); if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); } catch (e) {}
