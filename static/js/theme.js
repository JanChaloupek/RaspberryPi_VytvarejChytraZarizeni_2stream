// static/js/theme.js
(function () {
  const STORAGE_KEY = 'theme';
  const prefersDark = window.matchMedia &&
                      window.matchMedia('(prefers-color-scheme: dark)').matches;
  const saved = localStorage.getItem(STORAGE_KEY);
  const initialDark = saved ? saved === 'dark' : prefersDark;

  const body = document.body;
  const toggleBtn = document.getElementById('theme-toggle');
  const iconEl = toggleBtn?.querySelector('.theme-icon');

  function applyTheme(isDark) {
    body.classList.toggle('dark-mode', isDark);
    if (iconEl) iconEl.textContent = isDark ? '🌙' : '☀️';
    localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
  }

  // Inicializace při načtení
  applyTheme(initialDark);

  // Přepínač
  toggleBtn?.addEventListener('click', () => {
    const isDark = !body.classList.contains('dark-mode');
    applyTheme(isDark);
  });
})();
