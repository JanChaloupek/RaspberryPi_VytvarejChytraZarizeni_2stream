// static/js/actuatorsApi.js
// Modul pro volání REST API aktuátorů (LED, relé, setpoint).
// ----------------------------------------------------
// Účel:
// - Poskytuje funkce pro komunikaci s backendem aktuátorů.
// - Odděluje síťovou logiku (fetch) od UI.
// - Zajišťuje jednotné volání API pro LED, relé a setpoint.
// - Umožňuje GET i POST požadavky s volitelným JSON payloadem.
//
// Závislosti:
// - helpers.js (funkce fetchWrappedJson)
//
// Konfigurace:
// - API_BASE = '/api/actuators' (základní cesta pro REST API)
//
// Funkce:
// - callActorApi(actorName, method, body)
//   → Volá API pro daný aktuátor (LED/relay).
//   → Parametry:
//      - actorName: jméno aktuátoru (string, povinné)
//      - method: HTTP metoda ("GET" nebo "POST", default "GET")
//      - body: volitelný JSON payload (např. {on:true}, {mode:"auto"})
//   → Vrací Promise s JSON odpovědí.
//   → Při chybě vyhodí výjimku.
//
// - callSetpointApi(actorName, method, body)
//   → Volá API pro setpoint aktuátoru (relay).
//   → Parametry:
//      - actorName: jméno aktuátoru (string, povinné)
//      - method: HTTP metoda ("GET" nebo "POST", default "GET")
//      - body: volitelný JSON payload (např. {value:22.5})
//   → Vrací Promise s JSON odpovědí.
//   → Při chybě vyhodí výjimku.
//
// ----------------------------------------------------

import { fetchWrappedJson } from './helpers.js';

const API_BASE = '/api/actuators';

/**
 * callActorApi()
 * ----------------------------------------------------
 * Volá API pro daný aktuátor (LED/relay).
 * - Sestaví URL `${API_BASE}/${actorName}`.
 * - Podporuje GET i POST metody.
 * - Pokud je předán body, nastaví Content-Type a serializuje JSON.
 * - Loguje volání do konzole.
 *
 * @param {string} actorName Jméno aktuátoru (např. "led1", "relayA")
 * @param {string} [method="GET"] HTTP metoda ("GET" nebo "POST")
 * @param {object|null} [body=null] Volitelný JSON payload
 * @returns {Promise<object>} JSON odpověď z API
 * @throws {Error} Pokud není actorName zadán
 */
export async function callActorApi(actorName, method = "GET", body = null) {
  if (!actorName) throw new Error("No actor name provided");
  const url = `${API_BASE}/${encodeURIComponent(actorName)}`;
  const init = { method, headers: {} };
  if (body !== null) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  console.debug('[actuatorsApi] actor', actorName, method);
  return fetchWrappedJson(url, init);
}

/**
 * callSetpointApi()
 * ----------------------------------------------------
 * Volá API pro setpoint aktuátoru (relay).
 * - Sestaví URL `${API_BASE}/${actorName}/setpoint`.
 * - Podporuje GET i POST metody.
 * - Pokud je předán body, nastaví Content-Type a serializuje JSON.
 * - Loguje volání do konzole.
 *
 * @param {string} actorName Jméno aktuátoru (např. "relayA")
 * @param {string} [method="GET"] HTTP metoda ("GET" nebo "POST")
 * @param {object|null} [body=null] Volitelný JSON payload (např. {value:22.5})
 * @returns {Promise<object>} JSON odpověď z API
 * @throws {Error} Pokud není actorName zadán
 */
export async function callSetpointApi(actorName, method = "GET", body = null) {
  if (!actorName) throw new Error("No actor name provided for setpoint");
  const url = `${API_BASE}/${encodeURIComponent(actorName)}/setpoint`;
  const init = { method, headers: {} };
  if (body !== null) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  console.debug('[actuatorsApi] setpoint', actorName, method);
  return fetchWrappedJson(url, init);
}
