// static/js/theme.js
// Modul pro správu vzhledu (light/dark mode) na dashboardu.
// ----------------------------------------------------
// Účel:
// - Přepíná mezi světlým a tmavým režimem pomocí Bootstrap 5.3 (data-bs-theme).
// - Respektuje systémové nastavení uživatele (prefers-color-scheme).
// - Ukládá volbu do localStorage, aby se zachovala mezi relacemi.
// - Aktualizuje ikonu tlačítka podle aktuálního režimu.
//
// Závislosti:
// - HTML musí obsahovat <button id="theme-toggle"> s vnořeným elementem .theme-icon.
// - <html> musí mít atribut data-bs-theme (light/dark).
//
// Exporty:
// - Modul je IIFE (Immediately Invoked Function Expression), takže se spustí automaticky při načtení.

(function () {
  const STORAGE_KEY = 'theme';
  const prefersDark = window.matchMedia &&
                      window.matchMedia('(prefers-color-scheme: dark)').matches;
  const saved = localStorage.getItem(STORAGE_KEY);
  const initialTheme = saved ? saved : (prefersDark ? 'dark' : 'light');

  const html = document.documentElement;
  const toggleBtn = document.getElementById('theme-toggle');
  const iconEl = toggleBtn?.querySelector('.theme-icon');

  /**
   * applyTheme(theme)
   * ----------------------------------------------------
   * Nastaví vzhled aplikace podle parametru.
   * - Nastaví atribut data-bs-theme na <html>.
   * - Změní ikonu tlačítka (🌙 pro dark, ☀️ pro light).
   * - Uloží volbu do localStorage.
   *
   * @param {string} theme - 'dark' nebo 'light'
   */
  function applyTheme(theme) {
    html.setAttribute('data-bs-theme', theme);
    if (iconEl) iconEl.textContent = theme === 'dark' ? '🌙' : '☀️';
    localStorage.setItem(STORAGE_KEY, theme);
  }

  // Inicializace při načtení stránky
  applyTheme(initialTheme);

  // Přepínač režimu (kliknutí na tlačítko)
  toggleBtn?.addEventListener('click', () => {
    const current = html.getAttribute('data-bs-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });
})();
