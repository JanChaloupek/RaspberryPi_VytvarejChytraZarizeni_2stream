// static/js/plot.normalize.js
// Modul pro normalizaci dat z API do jednotné podoby.
// ----------------------------------------------------
// Účel:
// - Převádí data z API do jednotného formátu, který lze snadno použít pro vykreslení grafu.
// - Automaticky detekuje klíč s časovou hodnotou (timestamp).
// - Extrahuje hodnoty teploty, vlhkosti a rosného bodu, pokud jsou k dispozici.
// - Vrací objekt { x, temp, hum, dew, timeKey }.
//
// Závislosti:
// - Nepoužívá žádné externí moduly, pouze nativní JS.
//
// Funkce:
// - normalizeRows(rows)
//   → Přijímá pole řádků (objektů) z API.
//   → Pokud je pole prázdné, vrací prázdné pole x a null pro ostatní hodnoty.
//   → Automaticky detekuje časový klíč (ts, time, timestamp, key, date).
//   → Extrahuje hodnoty temperature/temp, humidity/hum, dew_point/dew.
//   → Vrací normalizovaný objekt { x, temp, hum, dew, timeKey }.
//
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
  if (!Array.isArray(rows) || rows.length === 0) {
    return { x: [], temp: null, hum: null, dew: null, timeKey: null };
  }

  const sample = rows[0];
  const keys = Object.keys(sample);

  // Detekce časového klíče
  const timeKey = keys.find(k => /^(ts|time|timestamp|key|date)$/i.test(k)) || keys[0];

  // Detekce dostupných metrik
  const hasTemp = keys.includes('temperature') || keys.includes('temp');
  const hasHum = keys.includes('humidity') || keys.includes('hum');
  const hasDew = keys.includes('dew_point') || keys.includes('dew');

  // Extrakce hodnot
  const x = rows.map(r => r[timeKey]);
  const temp = hasTemp ? rows.map(r => r.temperature ?? r.temp ?? null).map(Number) : null;
  const hum = hasHum ? rows.map(r => r.humidity ?? r.hum ?? null).map(Number) : null;
  const dew = hasDew ? rows.map(r => r.dew_point ?? r.dew ?? null).map(Number) : null;

  return { x, temp, hum, dew, timeKey };
}
