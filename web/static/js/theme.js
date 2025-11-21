// static/js/theme.js
// Modul pro správu vzhledu (light/dark mode) na dashboardu.
// ----------------------------------------------------
// Účel:
// - Umožňuje přepínání mezi světlým a tmavým režimem.
// - Respektuje systémové nastavení uživatele (prefers-color-scheme).
// - Ukládá volbu do localStorage, aby se zachovala mezi relacemi.
// - Aktualizuje ikonu tlačítka podle aktuálního režimu.
//
// Závislosti:
// - HTML musí obsahovat <button id="theme-toggle"> s vnořeným elementem .theme-icon.
// - CSS musí definovat třídu .dark-mode pro tmavý vzhled.
//
// Exporty:
// - Modul je IIFE (Immediately Invoked Function Expression), takže se spustí automaticky při načtení.
// - Neexportuje žádné funkce, vše je interní.

(function () {
  const STORAGE_KEY = 'theme';
  const prefersDark = window.matchMedia &&
                      window.matchMedia('(prefers-color-scheme: dark)').matches;
  const saved = localStorage.getItem(STORAGE_KEY);
  const initialDark = saved ? saved === 'dark' : prefersDark;

  const body = document.body;
  const toggleBtn = document.getElementById('theme-toggle');
  const iconEl = toggleBtn?.querySelector('.theme-icon');

  /**
   * applyTheme(isDark)
   * ----------------------------------------------------
   * Nastaví vzhled aplikace podle parametru.
   * - Přidá/odebere třídu .dark-mode na <body>.
   * - Změní ikonu tlačítka (🌙 pro dark, ☀️ pro light).
   * - Uloží volbu do localStorage.
   *
   * @param {boolean} isDark - true = tmavý režim, false = světlý režim
   */
  function applyTheme(isDark) {
    body.classList.toggle('dark-mode', isDark);
    if (iconEl) iconEl.textContent = isDark ? '🌙' : '☀️';
    localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
  }

  // Inicializace při načtení stránky
  applyTheme(initialDark);

  // Přepínač režimu (kliknutí na tlačítko)
  toggleBtn?.addEventListener('click', () => {
    const isDark = !body.classList.contains('dark-mode');
    applyTheme(isDark);
  });
})();
