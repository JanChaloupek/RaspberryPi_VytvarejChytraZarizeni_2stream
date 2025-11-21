// static/js/utils.js
// Modul s pomocnými funkcemi pro práci s časem, klíči a formátováním.
// ----------------------------------------------------
// Účel:
// - Poskytuje univerzální funkce pro generování klíčů (dnešní datum, ISO string).
// - Převádí klíče na Date objekty (parseLocalKey).
// - Formátuje klíče pro české zobrazení (formatKeyForCzechDisplay).
// - Nabízí překlady úrovní agregace do češtiny.
// - Definuje pořadí úrovní (LEVELS) a funkce pro navigaci mezi nimi.
// - Poskytuje krátké/strojové formáty klíčů (formatKeyForDisplay).
//
// Exportované funkce:
// - todayKey(), isoLocalString(), translateLevelToCzech(), parseLocalKey(),
//   formatKeyForCzechDisplay(), nextLevel(), parentLevel(), formatKeyForDisplay()
// - Exportovaná konstanta LEVELS

/**
 * todayKey()
 * ----------------------------------------------------
 * Vrátí dnešní datum ve formátu YYYY-MM-DD.
 * Používá se jako výchozí klíč pro agregaci.
 *
 * @returns {string} dnešní datum ve formátu YYYY-MM-DD
 */
export function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`; // YYYY-MM-DD
}

/**
 * isoLocalString(dt)
 * ----------------------------------------------------
 * Převede Date objekt nebo ISO string na lokální ISO string bez milisekund.
 * Formát: YYYY-MM-DDTHH:MM:SS
 *
 * @param {Date|string} dt - Date objekt nebo ISO string
 * @returns {string} normalizovaný ISO string
 */
export function isoLocalString(dt) {
  const d = (dt instanceof Date) ? dt : new Date(dt);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * translateLevelToCzech(level)
 * ----------------------------------------------------
 * Přeloží úroveň agregace do češtiny.
 *
 * @param {string} level - 'monthly', 'daily', 'hourly', 'minutely', 'raw'
 * @returns {string} český popis úrovně
 */
export function translateLevelToCzech(level) {
  switch (level) {
    case 'monthly': return 'agreguji měsíce';
    case 'daily': return 'agreguji dny';
    case 'hourly': return 'agreguji hodiny';
    case 'minutely': return 'agreguji minuty';
    case 'raw': return 'přímá změřená data';
    default: return level || '';
  }
}

/**
 * parseLocalKey(key)
 * ----------------------------------------------------
 * Robustní parser klíče na Date (lokální čas).
 * Podporuje formáty: YYYY, YYYY-MM, YYYY-MM-DD, YYYY-MM-DDTHH:MM, YYYY-MM-DDTHH:MM:SS.
 * Vrací Date reprezentující začátek zadaného intervalu.
 *
 * @param {string} key - časový klíč
 * @returns {Date} lokální Date objekt
 */
export function parseLocalKey(key) {
  if (!key) return new Date();
  const t = String(key).replace(' ', 'T');

  if (/^\d{4}$/.test(t)) return new Date(`${t}-01-01T00:00:00`);
  if (/^\d{4}-\d{2}$/.test(t)) return new Date(`${t}-01-01T00:00:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return new Date(`${t}T00:00:00`);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) return new Date(`${t}:00`);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(t)) return new Date(t);
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * formatKeyForCzechDisplay(key, level)
 * ----------------------------------------------------
 * Lokalizované české zobrazení klíče podle úrovně.
 * - monthly -> "mm.yyyy"
 * - daily -> "dd.mm.yyyy"
 * - hourly -> "dd.mm.yyyy - HH"
 * - minutely -> "dd.mm.yyyy - HH:MM"
 * - raw -> "dd.mm.yyyy - HH:MM:SS"
 *
 * @param {string} key - časový klíč
 * @param {string} level - úroveň agregace
 * @returns {string} český formátovaný řetězec
 */
export function formatKeyForCzechDisplay(key, level) {
  if (!key) return '--';
  const d = parseLocalKey(key);
  const pad = (n) => String(n).padStart(2, '0');

  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hour = pad(d.getHours());
  const minute = pad(d.getMinutes());
  const second = pad(d.getSeconds());

  switch (level) {
    case 'monthly': return `${month}.${year}`;
    case 'daily': return `${day}.${month}.${year}`;
    case 'hourly': return `${day}.${month}.${year} - ${hour}`;
    case 'minutely': return `${day}.${month}.${year} - ${hour}:${minute}`;
    case 'raw': return `${day}.${month}.${year} - ${hour}:${minute}:${second}`;
    default: return `${day}.${month}.${year}`;
  }
}

// Pořadí úrovní: monthly, daily, hourly, minutely, raw
export const LEVELS = ['monthly', 'daily', 'hourly', 'minutely', 'raw'];

/**
 * nextLevel(level)
 * ----------------------------------------------------
 * Vrátí detailnější úroveň než zadaná.
 * Např. 'daily' -> 'hourly'.
 *
 * @param {string} level - aktuální úroveň
 * @returns {string|null} další úroveň nebo null
 */
export function nextLevel(level) {
  const idx = LEVELS.indexOf(level);
  return idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

/**
 * parentLevel(level)
 * ----------------------------------------------------
 * Vrátí nadřazenou úroveň než zadaná.
 * Např. 'hourly' -> 'daily'.
 *
 * @param {string} level - aktuální úroveň
 * @returns {string|null} předchozí úroveň nebo null
 */
export function parentLevel(level) {
  const idx = LEVELS.indexOf(level);
  return idx > 0 ? LEVELS[idx - 1] : null;
}

/**
 * formatKeyForDisplay(key, level)
 * ----------------------------------------------------
 * Krátké/ne-lokalizované zobrazení klíče.
 * Vhodné pro strojové řetězce nebo export.
 * - monthly -> YYYY-MM
 * - daily -> YYYY-MM-DD
 * - hourly -> YYYY-MM-DD HH
 * - minutely -> YYYY-MM-DD HH:MM
 * - raw -> YYYY-MM-DD HH:MM:SS
 *
 * @param {string} key - časový klíč
 * @param {string} level - úroveň agregace
 * @returns {string} formátovaný řetězec
 */
export function formatKeyForDisplay(key, level) {
  if (!key) return '--';
  const t = String(key).replace(' ', 'T');
  switch (level) {
    case 'monthly': return t.slice(0,7);
    case 'daily': return t.slice(0,10);
    case 'hourly': return t.slice(0,13).replace('T',' ');
    case 'minutely': return t.slice(0,16).replace('T',' ');
    case 'raw': return t.replace('T',' ').slice(0,19);
    default: return key;
  }
}
