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
// - API_BASE = '/api/actuator' (základní cesta pro REST API)
// ----------------------------------------------------

import { fetchWrappedJson } from './helpers.js';

const API_BASE = '/api/actuator';

/**
 * Volá API pro LED aktuátor.
 * @param {string} sensorId - ID senzoru
 * @param {string} [method="GET"] - HTTP metoda ("GET" nebo "POST")
 * @param {object|null} body - volitelný JSON payload (např. {on:true})
 * @returns {Promise<object>} čistý result z API
 */
export async function callLedApi(sensorId, method = "GET", body = null) {
  const url = `${API_BASE}/${encodeURIComponent(sensorId)}/led`;
  const init = { method, headers: {} };
  if (body) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  console.info(`[API] LED ${method}`, url, body || '');
  try {
    const result = await fetchWrappedJson(url, init);
    console.info('[API] LED result', result);
    return result;
  } catch (err) {
    console.error('[API] LED error', err);
    throw err;
  }
}

/**
 * Volá API pro relé aktuátor.
 * @param {string} sensorId - ID senzoru
 * @param {string} [method="GET"] - HTTP metoda ("GET" nebo "POST")
 * @param {object|null} body - volitelný JSON payload (např. {mode:"auto"})
 * @returns {Promise<object>} čistý result z API
 */
export async function callRelayApi(sensorId, method = "GET", body = null) {
  const url = `${API_BASE}/${encodeURIComponent(sensorId)}/relay`;
  const init = { method, headers: {} };
  if (body) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  console.info(`[API] Relay ${method}`, url, body || '');
  try {
    const result = await fetchWrappedJson(url, init);
    console.info('[API] Relay result', result);
    return result;
  } catch (err) {
    console.error('[API] Relay error', err);
    throw err;
  }
}

/**
 * Volá API pro setpoint relé.
 * @param {string} sensorId - ID senzoru
 * @param {string} [method="GET"] - HTTP metoda ("GET" nebo "POST")
 * @param {object|null} body - volitelný JSON payload (např. {value:22.5})
 * @returns {Promise<object>} čistý result z API
 */
export async function callRelaySetpointApi(sensorId, method = "GET", body = null) {
  const url = `${API_BASE}/${encodeURIComponent(sensorId)}/relay/setpoint`;
  const init = { method, headers: {} };
  if (body) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  console.info(`[API] Setpoint ${method}`, url, body || '');
  try {
    const result = await fetchWrappedJson(url, init);
    console.info('[API] Setpoint result', result);
    return result;
  } catch (err) {
    console.error('[API] Setpoint error', err);
    throw err;
  }
}
