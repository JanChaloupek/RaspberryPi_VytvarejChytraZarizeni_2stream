// static/js/plot.utils.js
// Modul utilit pro práci s časem a číselnými hodnotami.
// ----------------------------------------------------
// Účel:
// - Poskytuje pomocné funkce používané napříč celým grafovým systémem.
// - Zajišťuje jednotné zpracování časových klíčů a číselných hodnot.
// - Obsahuje funkce pro získání dnešního klíče, převod ISO stringu na Date,
//   a výpočet základních statistik (min, max, průměr).
// - Přidány diagnostické logy.
// ----------------------------------------------------

/**
 * Vrátí dnešní datum ve formátu YYYY-MM-DD.
 * @returns {string} dnešní datum jako klíč
 */
export function todayKey() {
  const key = new Date().toISOString().slice(0, 10);
//  console.info('[plot.utils] todayKey returning', key);
  return key;
}

/**
 * Pokud je hodnota ISO string, převede ji na Date.
 * - Pokud je už Date, vrátí ji beze změny.
 * - Pokud je null/undefined, vrátí ji beze změny.
 * - Pokud je nevalidní string, vrátí původní hodnotu.
 *
 * @param {string|Date|null|undefined} v - hodnota k převodu
 * @returns {Date|string|null|undefined} převedená hodnota
 */
export function toDateIfIso(v) {
  if (v instanceof Date) {
//    console.info('[plot.utils] toDateIfIso already Date', v);
    return v;
  }
  if (v === null || v === undefined) {
    console.info('[plot.utils] toDateIfIso null/undefined', v);
    return v;
  }
  const d = new Date(v);
  if (isNaN(d)) {
    console.warn('[plot.utils] toDateIfIso invalid date string', v);
    return v;
  }
//  console.info('[plot.utils] toDateIfIso converted', v, '→', d);
  return d;
}

/**
 * Spočítá základní statistiky (min, max, průměr) pro pole hodnot.
 * - Ignoruje null, undefined a nečíselné hodnoty.
 *
 * @param {Array<number|string|null|undefined>} values - vstupní hodnoty
 * @returns {{min:number|null, max:number|null, avg:number|null}} statistiky
 */
export function computeStats(values) {
//  console.info('[plot.utils] computeStats input', values);

  const nums = values
    .filter(v => v !== null && v !== undefined && !Number.isNaN(Number(v)))
    .map(Number);

//  console.info('[plot.utils] computeStats filtered nums', nums);

  if (!nums.length) {
    console.warn('[plot.utils] computeStats no valid numbers');
    return { min: null, max: null, avg: null };
  }

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;

//  console.info('[plot.utils] computeStats result', { min, max, avg });

  return { min, max, avg };
}
