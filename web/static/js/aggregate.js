// static/js/aggregate.js
// Modul pro práci s agregovanými historickými daty.
// ----------------------------------------------------
// Účel:
// - Udržuje lokální stav (currentSensor, currentLevel, currentKey).
// - Volá API pro načtení agregovaných dat.
// - Renderuje breadcrumb navigaci a tabulku.
// - Aktualizuje poznámku o historii.
// - Vyvolává událost 'history-range-changed' pro ostatní části aplikace.
//
// Závislosti:
// - api.js (getAggregate)
// - breadcrumb.js (renderBreadcrumb)
// - table.js (renderTable)
// - utils.js (translateLevelToCzech)
//
// Exportované funkce:
// - setAggregateContext(sensor, level, key)
// - loadAggregate()
// ----------------------------------------------------

import { getAggregate } from './api.js';
import { renderBreadcrumb } from './breadcrumb.js';
import { renderTable } from './table.js';
import { translateLevelToCzech } from './utils.js';

let currentSensor = null;
let currentLevel = null;
let currentKey = null;

/**
 * Nastaví kontext pro načítání agregovaných dat.
 */
export function setAggregateContext(sensor, level, key) {
  currentSensor = sensor;
  currentLevel = level;
  currentKey = key;
  console.info('[aggregate] context set', { sensor, level, key });
}

/**
 * Aktualizuje textový prvek #history-note podle aktuální úrovně agregace.
 */
function updateHistoryNote(level) {
  const el = document.getElementById('history-note');
  if (el) {
    el.textContent = translateLevelToCzech(level);
    console.info('[aggregate] history note updated', level);
  }
}

/**
 * Načte a zobrazí agregovaná data pro aktuální kontext.
 */
export async function loadAggregate() {
  if (!currentSensor || !currentLevel || !currentKey) {
    console.warn('[aggregate] loadAggregate skipped – missing context', { currentSensor, currentLevel, currentKey });
    return;
  }
  const sensorAtCall = currentSensor;

  // Breadcrumb navigace
  renderBreadcrumb(document.getElementById('breadcrumb'), currentLevel, currentKey, (level, key) => {
    console.info('[aggregate] breadcrumb click', { level, key });
    currentLevel = level;
    currentKey = key;
    loadAggregate();
  });

  // Poznámka o historii
  updateHistoryNote(currentLevel);

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const tz_offset = new Date().getTimezoneOffset() * -1;

    // Volání API pro agregovaná data
    const resp = await getAggregate(sensorAtCall, currentLevel, currentKey, tz, tz_offset);
    const rows = resp?.result || [];
    console.info('[aggregate] API result', { query: resp?.query, rowsCount: rows.length });

    // Vykreslení tabulky
    console.debug('[aggregate] call renderTable() - rows', {rows})
    renderTable(document.querySelector('table'), rows, currentLevel, (childLevel, childKey) => {
      console.info('[aggregate] row click', { childLevel, childKey });
      currentLevel = childLevel;
      currentKey = childKey;
      loadAggregate();
    });

    // Vyvolání události pro ostatní části aplikace (např. grafy), předání načtených řádků a query
    window.dispatchEvent(new CustomEvent('history-range-changed', {
      detail: { sensor_id: sensorAtCall, level: currentLevel, key: currentKey, tz, tz_offset, rows: rows, query: resp?.query || null}
    }));
    console.info('[aggregate] event dispatched', { sensor_id: sensorAtCall, level: currentLevel, key: currentKey, tz, tz_offset });
  } catch (e) {
    console.error('[aggregate] loadAggregate failed', e);
    // fallback – prázdná tabulka
    renderTable(document.querySelector('table'), [], currentLevel, () => {});
  }
}
