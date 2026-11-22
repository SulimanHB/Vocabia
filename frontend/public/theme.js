// Aplica el tema elegido antes del primer pintado (archivo aparte: la CSP bloquea scripts en línea).
try {
  var theme = localStorage.getItem('vocabia.theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch (error) { /* almacenamiento bloqueado: se sigue el tema del sistema */ }
