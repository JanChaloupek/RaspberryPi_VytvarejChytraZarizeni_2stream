// static/js/plot.api.js
// Modul pro komunikaci s API /api/aggregate.
// ----------------------------------------------------
// Účel:
// - Poskytuje funkce pro sestavení URL pro volání API agregovaných dat.
// - Načítá data z endpointu /api/aggregate a předává je rendereru grafu.
// - Normalizuje načtená data a převádí časové hodnoty na Date objekty.
// - Slouží jako hlavní vstupní bod pro načítání a vykreslování grafů.
//
// Závislosti:
// - plot.utils.js (funkce todayKey, toDateIfIso)
// - plot.normalize.js (funkce normalizeRows)
// - plot.render.js (funkce renderPlot)
//
// Funkce:
// - buildAggregateUrl(params)
//   → Sestaví URL pro volání API /api/aggregate.
//   → Parametry:
//      - sensor_id: ID senzoru
//      - level: úroveň agregace (monthly, daily, hourly, …)
//      - key: časový klíč (např. "2025-11-11")
//      - tz: volitelně časová zóna
//      - tz_offset: volitelně offset časové zóny
//   → Vrací string s kompletní URL.
//
// - fetchAndPlot(params)
//   → Načte data z API a vykreslí graf.
//   → Postup:
//      1. Ověří parametry (sensor_id, level, key).
//      2. Pokud chybí key, nastaví ho na todayKey().
//      3. Sestaví URL pomocí buildAggregateUrl().
//      4. Zavolá fetch() s cache=no-store.
//      5. Zpracuje JSON odpověď (body.result, body.data nebo body).
//      6. Normalizuje řádky pomocí normalizeRows().
//      7. Převede hodnoty x na Date pomocí toDateIfIso().
//      8. Zavolá renderPlot() s normalizovanými daty.
//      9. Při chybě zaloguje error do konzole.
//
// ----------------------------------------------------

import { todayKey, toDateIfIso } from './plot.utils.js';
import { normalizeRows } from './plot.normalize.js';
import { renderPlot } from './plot.render.js';

/**
 * buildAggregateUrl(params)
 * ----------------------------------------------------
 * Sestaví URL pro volání API /api/aggregate.
 *
 * @param {object} params Parametry volání
 * @param {string} params.sensor_id ID senzoru
 * @param {string} params.level Úroveň agregace (např. "daily")
 * @param {string} params.key Časový klíč (např. "2025-11-11")
 * @param {string} [params.tz] Časová zóna
 * @param {number} [params.tz_offset] Offset časové zóny
 * @returns {string} Kompletní URL pro volání API
 */
export function buildAggregateUrl(params) {
  const { sensor_id, level, key, tz, tz_offset } = params;
  const q = new URLSearchParams();
  if (tz) q.set('tz', tz);
  if (tz_offset !== undefined && tz_offset !== null) q.set('tz_offset', tz_offset);
  return `/api/aggregate/${encodeURIComponent(sensor_id)}/${encodeURIComponent(level)}/${encodeURIComponent(key)}?${q.toString()}`;
}

/**
 * fetchAndPlot(params)
 * ----------------------------------------------------
 * Načte data z API a vykreslí graf.
 *
 * @param {object} params Parametry volání
 * @param {string} params.sensor_id ID senzoru
 * @param {string} params.level Úroveň agregace (např. "daily")
 * @param {string} params.key Časový klíč (např. "2025-11-11")
 * @param {string} [params.tz] Časová zóna
 * @param {number} [params.tz_offset] Offset časové zóny
 * @returns {Promise<void>}
 */
export async function fetchAndPlot(params) {
  if (!params || !params.sensor_id || !params.level || !params.key) return;
  if (!params.key) params.key = todayKey();

  const url = buildAggregateUrl(params);
  try {
    const resp = await fetch(url, { cache: 'no-store' });
    const body = await resp.json();

    const rows = body.result ?? body.data ?? body;
    const query = body.query ?? null;
    params.query = query;

    const normalized = normalizeRows(rows || []);
    normalized.x = normalized.x.map(toDateIfIso);

    renderPlot(normalized, params);
  } catch (err) {
    console.error('fetchAndPlot error', err);
  }
}
