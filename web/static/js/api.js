// static/js/api.js
// Modul pro volání backend API.
// ----------------------------------------------------
// Účel:
// - Poskytuje funkce pro načítání seznamu senzorů, posledních hodnot a agregovaných dat.
// - Implementuje fetch s podporou AbortController, aby se předešlo souběžným požadavkům.
// - Každý typ požadavku (sensors, latest, aggregate) má vlastní AbortController,
//   takže při novém volání se předchozí request stejného typu zruší.
//
// Exportované funkce:
// - getSensors()
// - getLatest(sensorId)
// - getAggregate(sensorId, level, key, tzName?, tzOffset?)

let sensorsController = null;
let latestController = null;
let aggregateController = null;

/**
 * fetchJsonWithAbort(url, which)
 * ----------------------------------------------------
 * Obecná funkce pro volání API s podporou AbortController.
 * - Pokud už běží požadavek stejného typu, předchozí request se zruší (abort).
 * - Vytvoří nový AbortController pro aktuální request.
 * - Provede fetch() s připojeným signalem.
 * - Pokud odpověď není OK, vyhodí chybu s textem odpovědi.
 * - Pokud je OK, vrátí JSON payload.
 * - Pokud dojde k AbortError, zaloguje varování a znovu vyhodí chybu.
 *
 * @param {string} url - adresa API endpointu
 * @param {string} which - logický typ požadavku ('sensors', 'latest', 'aggregate', nebo 'default')
 * @returns {Promise<object>} JSON payload z API
 * @throws {Error} pokud odpověď není OK nebo dojde k chybě
 */
async function fetchJsonWithAbort(url, which = 'default') {
  console.debug(`[api] fetch start (${which}):`, url);
  let controllerRef;
  if (which === 'sensors') {
    if (sensorsController) {
      console.debug('[api] aborting previous sensors request');
      try { sensorsController.abort(); } catch(e){}
    }
    sensorsController = new AbortController();
    controllerRef = sensorsController;
  } else if (which === 'latest') {
    if (latestController) {
      console.debug('[api] aborting previous latest request');
      try { latestController.abort(); } catch(e){}
    }
    latestController = new AbortController();
    controllerRef = latestController;
  } else if (which === 'aggregate') {
    if (aggregateController) {
      console.debug('[api] aborting previous aggregate request');
      try { aggregateController.abort(); } catch(e){}
    }
    aggregateController = new AbortController();
    controllerRef = aggregateController;
  } else {
    controllerRef = new AbortController();
  }

  try {
    const res = await fetch(url, { signal: controllerRef.signal });
    console.debug(`[api] fetch response (${which}):`, url, res.status);
    if (!res.ok) {
      const text = await res.text();
      console.error(`[api] non-ok response (${which}) ${res.status} for ${url}:`, text);
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const json = await res.json();
    console.debug(`[api] fetch json (${which}) for ${url}:`, json);
    return json;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn(`[api] fetch aborted (${which}):`, url);
      throw err;
    }
    console.error(`[api] fetch failed (${which}) for ${url}:`, err);
    throw err;
  }
}

/**
 * getSensors()
 * ----------------------------------------------------
 * Načte seznam dostupných senzorů z API (/api/sensors).
 * - Používá fetchJsonWithAbort s typem 'sensors'.
 * - Vrací pole senzorů (data.result).
 *
 * @returns {Promise<Array>} pole senzorů
 */
export async function getSensors() {
  const data = await fetchJsonWithAbort('/api/sensors', 'sensors');
  return data.result;
}

/**
 * getLatest(sensorId)
 * ----------------------------------------------------
 * Načte poslední hodnoty pro konkrétní senzor (/api/latest/<sensorId>).
 * - Používá fetchJsonWithAbort s typem 'latest'.
 * - Loguje požadovaný sensorId a odpověď z API.
 * - Vrací poslední hodnoty (data.result).
 *
 * @param {string} sensorId - ID senzoru
 * @returns {Promise<object>} poslední hodnoty pro senzor
 */
export async function getLatest(sensorId) {
  const url = `/api/latest/${encodeURIComponent(sensorId)}`;
  const data = await fetchJsonWithAbort(url, 'latest');
  console.debug('[api] getLatest: requested sensor=', sensorId, 'response.query?', data.query || null, 'result=', data.result);
  return data.result;
}

/**
 * getAggregate(sensorId, level, key, tzName?, tzOffset?)
 * ----------------------------------------------------
 * Načte agregovaná historická data pro senzor (/api/aggregate/<sensor_id>/<level>/<key>).
 * - Přidá volitelné parametry časové zóny (tz, tz_offset).
 * - Vrací JSON payload z API.
 *
 * @param {string} sensorId - ID senzoru
 * @param {string} level - úroveň agregace (např. 'daily', 'hourly')
 * @param {string} key - klíč časového intervalu (např. datum)
 * @param {string|null} tzName - volitelný název časové zóny
 * @param {number|null} tzOffset - volitelný offset časové zóny v minutách
 * @returns {Promise<object>} JSON payload z API
 */
export async function getAggregate(sensorId, level, key, tzName = null, tzOffset = null) {
  const qs = new URLSearchParams();
  if (tzName) qs.set('tz', tzName);
  if (tzOffset) qs.set('tz_offset', tzOffset);
  const url = `/api/aggregate/${encodeURIComponent(sensorId)}/${encodeURIComponent(level)}/${encodeURIComponent(key)}?${qs.toString()}`;
  console.debug('[api] getAggregate URL:', url);
  return fetchJsonWithAbort(url, 'aggregate');
}
