// static/js/helpers.js
// Modul s drobnými utilitami pro práci s DOM, URL a jména aktuátorů.
// ----------------------------------------------------
// Účel:
// - Poskytuje jednoduché pomocné funkce pro časté operace.
// - Zjednodušuje práci s DOM (vyhledávání elementů).
// - Umožňuje čtení query parametrů z URL.
// - Poskytuje wrapper pro fetch s kontrolou chyb.
// - Generuje konzistentní jména aktuátorů (např. led_sensorId).
//
// Exportované funkce:
// - qs(id)
// - getQueryParam(name)
// - fetchWrappedJson(url, opts)
// - actorForSensor(sensorId, kind, overrideActor)

/**
 * qs(id)
 * ----------------------------------------------------
 * Vrátí element podle ID.
 *
 * @param {string} id - ID elementu
 * @returns {HTMLElement|null} nalezený element nebo null
 */
export function qs(id) { 
  return document.getElementById(id); 
}

/**
 * getQueryParam(name)
 * ----------------------------------------------------
 * Vrátí hodnotu query parametru z URL.
 * - Používá URLSearchParams nad window.location.search.
 *
 * @param {string} name - název parametru
 * @returns {string|null} hodnota parametru nebo null
 *
 * @example
 * // Pokud je URL ?actor=relay_01
 * getQueryParam('actor'); // "relay_01"
 */
export function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

/**
 * fetchWrappedJson(url, opts)
 * ----------------------------------------------------
 * Zabalený fetch s kontrolou chyb.
 * - Volá fetch() s danými parametry.
 * - Pokud odpověď není OK, vyhodí chybu s textem.
 * - Pokud payload obsahuje .error, vyhodí chybu.
 * - Vrací payload.result.
 *
 * @param {string} url - URL endpointu
 * @param {object} opts - volitelné fetch options
 * @returns {Promise<any>} JSON payload.result
 *
 * @throws {Error} pokud odpověď není OK nebo payload obsahuje error
 */
export async function fetchWrappedJson(url, opts) {
  const res = await fetch(url, opts);
  console.debug('[fetchWrappedJson] raw response', res.status, res.statusText);
  if (!res.ok) {
    const text = await res.text().catch(()=>null);
    throw new Error(`${res.status} ${res.statusText}${text ? ': '+text : ''}`);
  }
  const payload = await res.json();
  console.debug('[fetchWrappedJson] payload', payload);
  if (payload.error) {
    throw new Error(payload.error);
  }
  return payload.result;
}

/**
 * actorForSensor(sensorId, kind, overrideActor)
 * ----------------------------------------------------
 * Vytvoří jméno aktuátoru ze sensorId.
 * - kind: 'led' nebo 'relay' (default 'led').
 * - Pokud je overrideActor, má přednost.
 * - Vrací string ve tvaru "kind_sensorId".
 *
 * @param {string} sensorId - ID senzoru
 * @param {string} kind - typ aktuátoru ('led' nebo 'relay')
 * @param {string|null} overrideActor - volitelný override jména
 * @returns {string|null} jméno aktuátoru nebo null
 *
 * @example
 * actorForSensor('DHT11_01'); // "led_DHT11_01"
 * actorForSensor('DHT11_01', 'relay'); // "relay_DHT11_01"
 * actorForSensor('DHT11_01', 'led', 'customActor'); // "customActor"
 */
export function actorForSensor(sensorId, kind = "led", overrideActor = null) {
  if (overrideActor) return overrideActor;
  if (!sensorId) return null;
  const safeKind = kind === "relay" ? "relay" : "led";
  const sid = String(sensorId).trim();
  if (!sid) return null;
  return `${safeKind}_${sid}`;
}
