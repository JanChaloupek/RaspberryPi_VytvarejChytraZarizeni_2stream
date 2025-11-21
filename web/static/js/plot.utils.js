// static/js/plot.utils.js
// Modul utilit pro práci s časem a číselnými hodnotami.
// ----------------------------------------------------
// Účel:
// - Poskytuje pomocné funkce používané napříč celým grafovým systémem.
// - Zajišťuje jednotné zpracování časových klíčů a číselných hodnot.
// - Obsahuje funkce pro získání dnešního klíče, převod ISO stringu na Date,
//   a výpočet základních statistik (min, max, průměr).
//
// Závislosti:
// - Nepoužívá žádné externí moduly, pouze nativní JS.
//
// Funkce:
// - todayKey()
//   → Vrátí dnešní datum ve formátu YYYY-MM-DD.
// - toDateIfIso(v)
//   → Pokud je hodnota ISO string, převede ji na Date.
//   → Pokud je již Date nebo null/undefined, vrátí původní hodnotu.
// - computeStats(values)
//   → Spočítá min, max, průměr pro pole hodnot.
//   → Ignoruje null, undefined a nečíselné hodnoty.
//   → Vrací objekt { min, max, avg }.
//
// ----------------------------------------------------

/**
 * todayKey()
 * ----------------------------------------------------
 * Vrátí dnešní datum ve formátu YYYY-MM-DD.
 *
 * @returns {string} Datum ve formátu YYYY-MM-DD
 */
export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * toDateIfIso(v)
 * ----------------------------------------------------
 * Pokud je hodnota ISO string, převede ji na Date.
 * - Pokud je hodnota již Date, vrátí ji beze změny.
 * - Pokud je null nebo undefined, vrátí původní hodnotu.
 * - Pokud převod selže, vrátí původní hodnotu.
 *
 * @param {string|Date|null|undefined} v Hodnota k převodu
 * @returns {Date|string|null|undefined} Date objekt nebo původní hodnota
 */
export function toDateIfIso(v) {
  if (v instanceof Date) return v;
  if (v === null || v === undefined) return v;
  const d = new Date(v);
  return isNaN(d) ? v : d;
}

/**
 * computeStats(values)
 * ----------------------------------------------------
 * Spočítá základní statistiky (min, max, průměr) pro pole hodnot.
 * - Ignoruje null, undefined a nečíselné hodnoty.
 * - Pokud pole neobsahuje žádné validní hodnoty, vrací { min: null, max: null, avg: null }.
 *
 * @param {Array<number>} values Pole hodnot
 * @returns {{min:number|null, max:number|null, avg:number|null}} Objekt se statistikami
 */
export function computeStats(values) {
  const nums = values
    .filter(v => v !== null && v !== undefined && !Number.isNaN(Number(v)))
    .map(Number);

  if (!nums.length) return { min: null, max: null, avg: null };

  return {
    min: Math.min(...nums),
    max: Math.max(...nums),
    avg: nums.reduce((a, b) => a + b, 0) / nums.length
  };
}
