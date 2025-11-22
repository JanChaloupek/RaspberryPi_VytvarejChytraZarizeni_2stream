// static/js/refresh.js
// Modul pro automatické obnovování dat na dashboardu.
// ----------------------------------------------------
// Účel:
// - Pravidelně volá funkce loadLatest(), loadAggregate() a refreshActuators() pro aktuální senzor.
// - Řídí interval automatického refreshování (start/stop).
// - Zajišťuje, že se neprovádí paralelní refresh (ochrana proti kolizi).
// - Respektuje viditelnost stránky (obnovuje jen pokud je stránka aktivní).
//
// Závislosti:
// - latest.js (funkce loadLatest)
// - aggregate.js (funkce loadAggregate)
// - actuators.js (funkce refreshActuators)
// - sensors.js (proměnná currentSensor)
//
// Konfigurace:
// - AUTO_REFRESH_MS = interval v milisekundách (default 10 sekund)

import { loadLatest } from './latest.js';
import { loadAggregate } from './aggregate.js';
import { refreshActuators } from './actuators.js';
import { currentSensor } from './sensors.js';

const AUTO_REFRESH_MS = 10_000;
let __autoRefreshId = null;
let __isRefreshing = false;

/**
 * callAppRefresh()
 * ----------------------------------------------------
 * Spustí jednorázový refresh dat pro aktuální senzor.
 * - Pokud už probíhá refresh, vrátí true (bez akce).
 * - Pokud není vybraný senzor, vrátí false.
 * - Volá loadLatest(), loadAggregate() a refreshActuators() sekvenčně.
 * - Zachytává chyby a loguje je do konzole.
 *
 * @returns {Promise<boolean>} true pokud proběhl pokus o refresh, false pokud chyběl senzor
 */
async function callAppRefresh() {
  if (__isRefreshing) return true;
  if (!currentSensor) return false;
  if (document.visibilityState !== 'visible') return true; // stránka není viditelná → přeskoč

  __isRefreshing = true;
  try {
    await loadLatest();
    await loadAggregate();
    await refreshActuators();
    return true;
  } catch (e) {
    console.error('[refresh] Auto-refresh error:', e);
    return true;
  } finally {
    __isRefreshing = false;
  }
}

/**
 * startAutoRefresh()
 * ----------------------------------------------------
 * Spustí automatické obnovování dat v intervalu AUTO_REFRESH_MS.
 * - Pokud už interval běží, nic neudělá.
 * - Okamžitě provede první refresh.
 * - V intervalu volá callAppRefresh().
 * - Pokud callAppRefresh vrátí false (není senzor), interval se zastaví.
 */
export function startAutoRefresh() {
  if (__autoRefreshId !== null) return;
  callAppRefresh().catch(err => console.error('[refresh] initial call failed:', err));
  __autoRefreshId = setInterval(() => {
    callAppRefresh().then(ok => {
      if (!ok) stopAutoRefresh();
    }).catch(err => console.error('[refresh] interval call failed:', err));
  }, AUTO_REFRESH_MS);
}

/**
 * stopAutoRefresh()
 * ----------------------------------------------------
 * Zastaví automatické obnovování dat.
 * - Pokud interval běží, vymaže ho a nastaví __autoRefreshId na null.
 */
export function stopAutoRefresh() {
  if (__autoRefreshId !== null) {
    clearInterval(__autoRefreshId);
    __autoRefreshId = null;
  }
}
