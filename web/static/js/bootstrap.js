// static/js/bootstrap.js
// Modul pro inicializaci aplikace po načtení DOMu.
// ----------------------------------------------------
// Účel:
// - Spustí hlavní inicializační kroky aplikace po načtení DOM.
// - Získá informace o uživateli a zaloguje je.
// - Podle role uživatele případně načte modul pro logy.
// - Načte seznam senzorů.
// - Spustí automatické obnovování dat.
//
// Závislosti:
// - user.js (funkce getUserInfo)
// - sensors.js (funkce loadSensors)
// - refresh.js (funkce startAutoRefresh)
// - logs.js (dynamický import, pouze pro admina)
//
// Funkce:
// - DOMContentLoaded listener → hlavní inicializační logika aplikace.
//   Postup:
//   1. Zaloguji informaci, že DOM je připraven.
//   2. Načtu informace o uživateli pomocí getUserInfo().
//   3. Pokud má uživatel roli 'admin', dynamicky importuji modul logs.js
//      a spustím jeho init() (pokud existuje).
//   4. Načtu seznam senzorů pomocí loadSensors().
//   5. Spustím automatické obnovování dat pomocí startAutoRefresh().
//
// ----------------------------------------------------

import { getUserInfo } from './user.js';
import { loadSensors } from './sensors.js';
import { startAutoRefresh } from './refresh.js';

/**
 * DOMContentLoaded listener
 * ----------------------------------------------------
 * Spustí se, jakmile je DOM kompletně načtený.
 * - Zajistí, že všechny potřebné prvky jsou dostupné.
 * - Spouští hlavní inicializační kroky aplikace.
 *
 * @returns {Promise<void>}
 */
window.addEventListener('DOMContentLoaded', async () => {
  // 1. Zaloguji informaci, že DOM je připraven.
  console.debug('[bootstrap] DOMContentLoaded');

  // 2. Získání informací o uživateli
  const user = await getUserInfo();
  console.info('[bootstrap] user info:', user);

  // 3. Pokud je uživatel admin, načti modul pro logy
  if (user.role === 'admin') {
    import('./logs.js')
      .then(m => m.init?.())
      .catch(console.error);
  }

  // 4. Načti seznam senzorů
  await loadSensors();

  // 5. Spusť automatické obnovování dat
  startAutoRefresh();
});
