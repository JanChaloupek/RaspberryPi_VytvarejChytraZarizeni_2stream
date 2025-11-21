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

import { getAggregate } from './api.js';
import { renderBreadcrumb } from './breadcrumb.js';
import { renderTable } from './table.js';
import { translateLevelToCzech } from './utils.js';

// Lokální stav pro aggregate modul
// ---------------------------------
// currentSensor – ID senzoru, pro který se načítají data
// currentLevel  – úroveň agregace (např. 'daily', 'hourly')
// currentKey    – klíč časového intervalu (např. konkrétní datum)
let currentSensor = null;
let currentLevel = null;
let currentKey = null;

/**
 * setAggregateContext(sensor, level, key)
 * ----------------------------------------------------
 * Nastaví kontext pro načítání agregovaných dat.
 * - sensor: ID senzoru
 * - level: úroveň agregace (např. 'daily', 'hourly')
 * - key: klíč časového intervalu (např. '2025-11-10')
 *
 * @param {string} sensor - ID senzoru
 * @param {string} level - úroveň agregace
 * @param {string} key - časový klíč
 */
export function setAggregateContext(sensor, level, key) {
  currentSensor = sensor;
  currentLevel = level;
  currentKey = key;
}

/**
 * updateHistoryNote(level)
 * ----------------------------------------------------
 * Aktualizuje textový prvek #history-note podle aktuální úrovně agregace.
 * - Používá translateLevelToCzech() pro překlad úrovně do češtiny.
 *
 * @param {string} level - úroveň agregace
 */
function updateHistoryNote(level) {
  const el = document.getElementById('history-note');
  if (el) el.textContent = translateLevelToCzech(level);
}

/**
 * loadAggregate()
 * ----------------------------------------------------
 * Načte a zobrazí agregovaná data pro aktuální kontext (sensor, level, key).
 * Postup:
 * 1. Ověří, zda je nastavený kontext (jinak funkci přeskočí).
 * 2. Vykreslí breadcrumb navigaci – kliknutí na breadcrumb změní level/key a znovu načte data.
 * 3. Aktualizuje poznámku o historii (#history-note).
 * 4. Zavolá API getAggregate() a získá data.
 * 5. Vykreslí tabulku pomocí renderTable() – kliknutí na řádek změní level/key a znovu načte data.
 * 6. Vyvolá událost 'history-range-changed' s detaily (sensor_id, level, key, timezone, offset).
 * 7. Pokud API selže, vypíše chybu do konzole a vykreslí prázdnou tabulku.
 *
 * @returns {Promise<void>}
 */
export async function loadAggregate() {
  if (!currentSensor || !currentLevel || !currentKey) {
    console.debug('[aggregate] loadAggregate skipped – missing context', { currentSensor, currentLevel, currentKey });
    return;
  }
  const sensorAtCall = currentSensor;

  // Breadcrumb navigace
  renderBreadcrumb(document.getElementById('breadcrumb'), currentLevel, currentKey, (level, key) => {
    console.debug('[aggregate] breadcrumb click', { level, key });
    currentLevel = level;
    currentKey = key;
    loadAggregate();
  });

  // Poznámka o historii
  updateHistoryNote(currentLevel);

  try {
    // Volání API pro agregovaná data
    const resp = await getAggregate(sensorAtCall, currentLevel, currentKey);
    const rows = resp.result || [];

    // Vykreslení tabulky
    renderTable(document.querySelector('table'), rows, currentLevel, (childLevel, childKey) => {
      console.debug('[aggregate] row click', { childLevel, childKey });
      currentLevel = childLevel;
      currentKey = childKey;
      loadAggregate();
    });

    // Vyvolání události pro ostatní části aplikace
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const tz_offset = new Date().getTimezoneOffset() * -1;
    window.dispatchEvent(new CustomEvent('history-range-changed', {
      detail: { sensor_id: sensorAtCall, level: currentLevel, key: currentKey, tz, tz_offset }
    }));
  } catch (e) {
    console.error('loadAggregate failed', e);
    // fallback – prázdná tabulka
    renderTable(document.querySelector('table'), [], currentLevel, () => {});
  }
}
