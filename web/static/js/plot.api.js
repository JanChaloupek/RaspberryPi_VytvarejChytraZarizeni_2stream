// static/js/plot.api.js
// Modul pro komunikaci s API /api/aggregate.
// ----------------------------------------------------
// Účel:
// - Poskytuje funkce pro sestavení URL pro volání API agregovaných dat.
// - Načítá data z endpointu /api/aggregate a předává je rendereru grafu.
// - Normalizuje načtená data a převádí časové hodnoty na Date objekty.
// - Slouží jako hlavní vstupní bod pro načítání a vykreslování grafů.
// ----------------------------------------------------

import { todayKey, toDateIfIso } from './plot.utils.js';
import { normalizeRows } from './plot.normalize.js';
import { renderPlot } from './plot.render.js';

/**
 * Sestaví URL pro volání API /api/aggregate.
 * @param {object} params - Parametry volání
 * @param {string} params.sensor_id - ID senzoru
 * @param {string} params.level - úroveň agregace (např. 'daily', 'hourly')
 * @param {string} params.key - klíč časového intervalu
 * @param {string} [params.tz] - název časové zóny
 * @param {number} [params.tz_offset] - offset časové zóny v minutách
 * @returns {string} URL pro volání API
 */
export function buildAggregateUrl(params) {
  const { sensor_id, level, key, tz, tz_offset } = params;
  const q = new URLSearchParams();
  if (tz) q.set('tz', tz);
  if (tz_offset !== undefined && tz_offset !== null) q.set('tz_offset', tz_offset);
  return `/api/aggregate/${encodeURIComponent(sensor_id)}/${encodeURIComponent(level)}/${encodeURIComponent(key)}?${q.toString()}`;
}

/**
 * Načte data z API a vykreslí graf.
 * @param {object} params - Parametry volání
 * @returns {Promise<void>}
 */
export async function fetchAndPlot(params) {
  if (!params || !params.sensor_id || !params.level) {
    console.warn('[plot.api] fetchAndPlot skipped – missing params', params);
    return;
  }
  if (!params.key) params.key = todayKey();
  
  if (!params.rows) {
  }

  try {
    let rows = null;
    let query = null;
    if (params.rows) {
      // Pokud jsou řádky předány přímo v parametrech, použij je
      console.info('[plot.api] using provided rows', params.rows);
      rows = params.rows;
      query = params.query ?? null;
    } else {
      // Jinak načti data z API
      const url = buildAggregateUrl(params);
      const resp = await fetch(url, { cache: 'no-store' });
      console.info('[plot.api] fetch response', url, resp.status);

      if (!resp.ok) {
        const text = await resp.text().catch(() => null);
        console.error('[plot.api] non-ok response', resp.status, text);
        return;
      }

      const body = await resp.json();
      console.info('[plot.api] fetch json', body);

      rows = body.result;
      query = body.query || null;
    }
    if (!rows || !Array.isArray(rows)) {
      console.warn('[plot.api] no rows returned', rows);
      return;
    }
    console.info('[plot.api] rows3', rows);

    params.query = query;
    console.info('[plot.api] raw rows', rows);

    let normalized;
    try {
      normalized = normalizeRows(rows);
      normalized.x = (normalized.x || []).map(v => {
        try {
          return toDateIfIso(v);
        } catch (err) {
          console.error('[plot.api] toDateIfIso error', v, err);
          return v;
        }
      });
    } catch (err) {
      console.error('[plot.api] normalizeRows error', err);
      return;
    }

    console.info('[plot.api] normalized data', normalized);
    console.info('[plot.api] calling renderPlot', { normalized, params });
    renderPlot(normalized, params);
  } catch (err) {
    console.error('[plot.api] fetchAndPlot error', err);
  }
}
