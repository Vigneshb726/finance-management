// Apply the saved theme before first paint to avoid a flash.
// Kept as an external file so it is allowed by the production Content-Security-Policy.
try {
  var t = localStorage.getItem('finora-theme') || 'SYSTEM';
  var dark = t === 'DARK' || (t === 'SYSTEM' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
