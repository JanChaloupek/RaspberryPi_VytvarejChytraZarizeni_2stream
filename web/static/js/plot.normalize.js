// static/js/plot.normalize.js
// Modul pro normalizaci dat z API do jednotné podoby.
// ----------------------------------------------------
// Účel:
// - Převádí data z API do jednotného formátu, který lze snadno použít pro vykreslení grafu.
// - Automaticky detekuje klíč s časovou hodnotou (timestamp).
// - Extrahuje hodnoty teploty, vlhkosti a rosného bodu, pokud jsou k dispozici.
// - Vrací objekt { x, temp, hum, dew, timeKey }.
// - Přidány diagnostické logy pro ladění.
// ----------------------------------------------------

/**
 * normalizeRows(rows)
 * ----------------------------------------------------
 * Normalizuje data z API do jednotného formátu.
 *
 * @param {Array<object>} rows Pole řádků z API
 * @returns {{x: Array<any>, temp: Array<number>|null, hum: Array<number>|null, dew: Array<number>|null, timeKey: string|null}}
 *          Normalizovaná data pro graf
 */
export function normalizeRows(rows) {
  console.log('[normalizeRows] called with rows:', rows);

  if (!Array.isArray(rows) || rows.length === 0) {
    console.warn('[normalizeRows] rows is empty or not an array');
    return { x: [], temp: null, hum: null, dew: null, timeKey: null };
  }

  const sample = rows[0];
  const keys = Object.keys(sample);
  console.log('[normalizeRows] sample row keys:', keys);

  // Detekce časového klíče
  const timeKey = keys.find(k => /^(ts|time|timestamp|key|date)$/i.test(k)) || keys[0];
  console.log('[normalizeRows] detected timeKey:', timeKey);

  // Detekce dostupných metrik
  const hasTemp = keys.includes('temperature') || keys.includes('temp');
  const hasHum = keys.includes('humidity') || keys.includes('hum');
  const hasDew = keys.includes('dew_point') || keys.includes('dew');
  console.log('[normalizeRows] metrics detected:', { hasTemp, hasHum, hasDew });

  // Extrakce hodnot
  const x = rows.map(r => r[timeKey]);
  const temp = hasTemp ? rows.map(r => r.temperature ?? r.temp ?? null).map(Number) : null;
  const hum = hasHum ? rows.map(r => r.humidity ?? r.hum ?? null).map(Number) : null;
  const dew = hasDew ? rows.map(r => r.dew_point ?? r.dew ?? null).map(Number) : null;

  console.log('[normalizeRows] output lengths:', {
    x: x.length,
    temp: temp ? temp.length : null,
    hum: hum ? hum.length : null,
    dew: dew ? dew.length : null
  });
  console.log('[normalizeRows] first values:', {
    x: x[0],
    temp: temp ? temp[0] : null,
    hum: hum ? hum[0] : null,
    dew: dew ? dew[0] : null
  });

  return { x, temp, hum, dew, timeKey };
}
