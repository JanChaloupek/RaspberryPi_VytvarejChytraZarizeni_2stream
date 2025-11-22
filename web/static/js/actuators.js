// static/js/actuators.js
// Modul pro inicializaci UI aktuátorů a obsluhu událostí.
// ----------------------------------------------------
// Účel:
// - Inicializuje ovládací prvky pro LED, relé a setpoint.
// - Načítá aktuální stav aktuátorů ze serveru pro vybraný senzor.
// - Poskytuje obsluhu událostí (toggle LED, tlačítka relé, slider setpoint).
// - Zajišťuje synchronizaci UI s backendem a obnovu stavu při změně senzoru.
// - Exportuje refreshActuators() pro centrální refresh.
//
// Závislosti:
// - helpers.js (qs)
// - actuatorsApi.js (callLedApi, callRelayApi, callRelaySetpointApi)
// - actuatorsUI.js (setLedUI, setRelayUI, setSetpointUI)
// ----------------------------------------------------

import { qs } from './helpers.js';
import { callLedApi, callRelayApi, callRelaySetpointApi } from './actuatorsApi.js';
import { setLedUI, setRelayUI, setSetpointUI } from './actuatorsUI.js';

let sensorSelect = null;
let spTimer = null;

/**
 * Vrátí ID aktuálně vybraného senzoru.
 * @returns {string|null}
 */
function currentSensorId() {
  const sel = qs('sensor_select');
  return sel?.value || null;
}

/**
 * Načte stav LED, relé a setpointu pro aktuální senzor.
 * - Volá API (GET).
 * - Aktualizuje UI prvky.
 * - Používá fallbacky pokud API vrátí neúplná data.
 */
async function loadForCurrentSensor() {
  const sid = currentSensorId();

  if (spTimer) {
    clearTimeout(spTimer);
    spTimer = null;
  }

  // LED
  try {
    if (sid) {
      const ledState = await callLedApi(sid, "GET");
      if (ledState && typeof ledState.logical !== 'undefined') {
        setLedUI(ledState.logical, ledState.hw, qs('led-status'), qs('led-toggle'));
      } else {
        console.warn('[LED] Missing logical in result, applying fallback UI');
        setLedUI(false, null, qs('led-status'), qs('led-toggle'));
      }
    } else {
      setLedUI(false, null, qs('led-status'), qs('led-toggle'));
    }
  } catch (err) {
    console.error('[LED] Error loading state:', err);
    setLedUI(false, null, qs('led-status'), qs('led-toggle'));
  }

  // Relay
  try {
    if (sid) {
      const relayState = await callRelayApi(sid, "GET");
      if (relayState && typeof relayState.mode !== 'undefined') {
        setRelayUI(relayState.mode, relayState.logical, relayState.hw,
                   qs('relay-mode'), qs('relay-on'), qs('relay-off'), qs('relay-auto'));
      } else {
        console.warn('[Relay] Missing mode in result, applying fallback UI');
        setRelayUI('auto', false, null, qs('relay-mode'), qs('relay-on'), qs('relay-off'), qs('relay-auto'));
      }
    } else {
      setRelayUI('auto', false, null, qs('relay-mode'), qs('relay-on'), qs('relay-off'), qs('relay-auto'));
    }
  } catch (err) {
    console.error('[Relay] Error loading state:', err);
    setRelayUI('auto', false, null, qs('relay-mode'), qs('relay-on'), qs('relay-off'), qs('relay-auto'));
  }

  // Setpoint
  try {
    if (sid) {
      const sp = await callRelaySetpointApi(sid, "GET");
      if (sp && typeof sp.value !== 'undefined' && sp.value !== null) {
        setSetpointUI(Number(sp.value), qs('setpoint-value'), qs('setpoint'));
      } else {
        console.warn('[Setpoint] value missing/null, applying UI null');
        setSetpointUI(null, qs('setpoint-value'), qs('setpoint'));
      }
    } else {
      setSetpointUI(null, qs('setpoint-value'), qs('setpoint'));
    }
  } catch (err) {
    console.error('[Setpoint] Error loading state:', err);
    setSetpointUI(null, qs('setpoint-value'), qs('setpoint'));
  }
}

/**
 * Exportovaná funkce pro centrální refresh.
 * Volá loadForCurrentSensor() → používá ji refresh.js.
 */
export async function refreshActuators() {
  await loadForCurrentSensor();
}

/**
 * Inicializace UI aktuátorů.
 * - Najde prvky v DOM.
 * - Připojí posluchače událostí (LED toggle, relay buttons, setpoint slider).
 * - Načte stav pro aktuálně vybraný senzor.
 */
async function init() {
  sensorSelect = qs('sensor_select');
  if (!sensorSelect) {
    console.error('actuators.js: required select with id "sensor_select" not found in DOM. Actuator UI disabled.');
    return;
  }

  const ledToggle = qs('led-toggle');
  const ledStatus = qs('led-status');
  const relayOnBtn = qs('relay-on');
  const relayOffBtn = qs('relay-off');
  const relayAutoBtn = qs('relay-auto');
  const relayModeText = qs('relay-mode');
  const setpoint = qs('setpoint');
  const setpointValue = qs('setpoint-value');

  /**
   * Listener pro LED toggle.
   * - Optimisticky nastaví UI.
   * - Volá API (POST + GET).
   * - Při chybě revertuje UI a zobrazí alert.
   */
  ledToggle?.addEventListener('change', async (ev) => {
    const on = ev.target.checked;
    setLedUI(on, null, ledStatus, ledToggle); // optimistický update
    try {
      const sid = currentSensorId();
      if (!sid) throw new Error("No sensor selected");
    await callLedApi(sid, "POST", { on });
    const ledState = await callLedApi(sid, "GET");
    console.info('[LED] GET after POST', ledState);
    if (ledState && typeof ledState.logical !== 'undefined') {
      setLedUI(ledState.logical, ledState.hw, ledStatus, ledToggle);
    } else {
      console.warn('[LED] GET after POST missing logical, reverting UI');
      setLedUI(!on, null, ledStatus, ledToggle);
    }
    } catch (err) {
      console.error('[LED] Error changing state:', err);
      setLedUI(!on, null, ledStatus, ledToggle);
      alert('Chyba: nelze změnit stav LED');
    }
  });

  /**
   * Funkce pro změnu režimu relé.
   * - Optimisticky nastaví UI.
   * - Volá API (POST + GET).
   * - Při chybě revertuje text a zobrazí alert.
   */
  async function setRelayMode(mode) {
    const prev = relayModeText ? relayModeText.textContent : '';
    setRelayUI(mode, false, null, relayModeText, relayOnBtn, relayOffBtn, relayAutoBtn);
    try {
      const sid = currentSensorId();
      if (!sid) throw new Error("No sensor selected");
    await callRelayApi(sid, "POST", { mode });
    const relayState = await callRelayApi(sid, "GET");
    console.info('[Relay] GET after POST', relayState);
    if (relayState && typeof relayState.mode !== 'undefined') {
      setRelayUI(relayState.mode, relayState.logical, relayState.hw,
                relayModeText, relayOnBtn, relayOffBtn, relayAutoBtn);
    } else {
      console.warn('[Relay] GET after POST missing mode, restoring prev text');
      if (relayModeText) relayModeText.textContent = prev;
    }
    } catch (err) {
      console.error('[Relay] Error changing mode:', err);
      if (relayModeText) relayModeText.textContent = prev;
      alert('Chyba: nelze změnit režim relé');
      await loadForCurrentSensor();
    }
  }


  relayOnBtn?.addEventListener('click', () => setRelayMode('on'));
  relayOffBtn?.addEventListener('click', () => setRelayMode('off'));
  relayAutoBtn?.addEventListener('click', () => setRelayMode('auto'));

  /**
   * Listener pro slider setpointu.
   * - Zobrazuje hodnotu °C.
   * - Po 600 ms volá sendSetpoint().
   */
  if (setpoint) {
    setpoint.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v)) {
        console.warn('[Setpoint] input not finite, ignore');
        return;
      }
      if (setpointValue) setpointValue.textContent = `${v} °C`;
      if (spTimer) clearTimeout(spTimer);
      spTimer = setTimeout(() => {
        sendSetpoint(v);
      }, 600);
    });
  }

  /**
   * Funkce pro odeslání nového setpointu na server.
   * - Optimisticky aktualizuje UI (zobrazení hodnoty).
   * - Volá API (POST) pro uložení hodnoty.
   * - Poté volá API (GET) pro ověření uložené hodnoty.
   * - Pokud API vrátí chybu nebo neúplná data:
   *   - Vrátí slider na předchozí hodnotu.
   *   - Zobrazí alert uživateli.
   *   - Provede fallback načtení stavu.
   *
   * @param {number} value - nová hodnota setpointu (°C)
   */
  async function sendSetpoint(value) {
    const prev = setpoint ? setpoint.value : null;
    try {
      const sid = currentSensorId();
      if (sid) {
      await callRelaySetpointApi(sid, "POST", { value: parseFloat(value) });
      // odložený GET pro HW stav
      setTimeout(async () => {
        const sp = await callRelaySetpointApi(sid, "GET");
        console.info('[Setpoint] GET after POST', sp);
        if (sp && typeof sp.value !== 'undefined' && sp.value !== null) {
          setSetpointUI(Number(sp.value), setpointValue, setpoint);
        } else {
          console.warn('[Setpoint] GET after POST missing/null value, keeping prev');
          if (setpoint) setpoint.value = prev;
        }
      }, 300);
      } else {
        console.warn('[Setpoint] sendSetpoint without sensor, skipping');
      }
    } catch (err) {
      console.error('[Setpoint] Error saving setpoint:', err);
      alert('Chyba: nelze uložit setpoint');
      if (setpoint) setpoint.value = prev;
      await loadForCurrentSensor();
    }
  }


  // --- Inicializační načtení stavu ---
  await loadForCurrentSensor();

  // --- Listener na změnu senzoru ---
  sensorSelect.addEventListener('change', async () => {
    if (spTimer) {
      clearTimeout(spTimer);
      spTimer = null;
    }
    await loadForCurrentSensor();
  });
}

// Spuštění inicializace po načtení DOMu
document.addEventListener('DOMContentLoaded', init);

// Export default (prázdný objekt pro kompatibilitu)
export default {};
