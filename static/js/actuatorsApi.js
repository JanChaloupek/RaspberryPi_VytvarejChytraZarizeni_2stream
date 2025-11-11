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

const API_BASE = '/api/actuator';

export async function callLedApi(sensorId, method = "GET", body = null) {
  const url = `${API_BASE}/${encodeURIComponent(sensorId)}/led`;
  const init = { method, headers: {} };
  if (body) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return fetchWrappedJson(url, init);
}

export async function callRelayApi(sensorId, method = "GET", body = null) {
  const url = `${API_BASE}/${encodeURIComponent(sensorId)}/relay`;
  const init = { method, headers: {} };
  if (body) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return fetchWrappedJson(url, init);
}

export async function callRelaySetpointApi(sensorId, method = "GET", body = null) {
  const url = `${API_BASE}/${encodeURIComponent(sensorId)}/relay/setpoint`;
  const init = { method, headers: {} };
  if (body) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return fetchWrappedJson(url, init);
}
