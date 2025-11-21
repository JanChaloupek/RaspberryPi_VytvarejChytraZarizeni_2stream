// static/js/snapshot.js
// Modul pro zobrazení snapshotu času na dashboardu.
// ----------------------------------------------------
// Účel:
// - Přijímá ISO časový string z backendu.
// - Převádí ho na formát vhodný pro české zobrazení (pomocí utils.js).
// - Aktualizuje obsah elementu <span id="snapshot-time">.
// - Nastavuje atribut `datetime` pro strojově čitelné zpracování.
//
// Závislosti:
// - utils.js (formatKeyForCzechDisplay)
//
// Použití:
// - Volá se při načtení nebo aktualizaci dat z backendu,
//   aby se uživateli zobrazil aktuální čas snapshotu.

import { formatKeyForCzechDisplay } from './utils.js';

/**
 * updateSnapshotFromIso(isoString)
 * ----------------------------------------------------
 * Aktualizuje element #snapshot-time podle ISO stringu.
 * - Pokud element neexistuje, funkce se ukončí.
 * - Pokusí se převést ISO string na Date.
 * - Vytvoří normalizovaný klíč ve tvaru YYYY-MM-DDTHH:mm:ss.
 * - Pomocí formatKeyForCzechDisplay() zobrazí čas v českém formátu.
 * - Nastaví atribut `datetime` na validní ISO, pokud je parsovatelný.
 * - Pokud parsování selže, atribut `datetime` se odstraní.
 *
 * @param {string} isoString - ISO časový řetězec z backendu
 */
export function updateSnapshotFromIso(isoString) {
  const tEl = document.getElementById('snapshot-time');
  if (!tEl) return;

  // Vytvoříme klíč vhodný pro parseLocalKey v utils.js
  const dateKey = (() => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const pad = n => String(n).padStart(2,'0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch (e) {
      return isoString;
    }
  })();

  // Formátujeme čas pro zobrazení
  const formatted = formatKeyForCzechDisplay(dateKey, 'raw'); 
  tEl.textContent = formatted;

  // Nastavíme strojově čitelný atribut datetime
  try {
    const dt = new Date(isoString);
    if (!isNaN(dt.getTime())) {
      tEl.setAttribute('datetime', dt.toISOString());
    } else {
      tEl.removeAttribute('datetime');
    }
  } catch (e) {
    tEl.removeAttribute('datetime');
  }
}
