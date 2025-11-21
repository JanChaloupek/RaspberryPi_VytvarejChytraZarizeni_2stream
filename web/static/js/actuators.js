// static/js/actuators.js
// Modul pro hlavní inicializaci UI aktuátorů, načítání stavu ze serveru a obsluhu událostí.
// ----------------------------------------------------
// Účel:
// - Inicializuje ovládací prvky pro LED, relé a setpoint.
// - Načítá aktuální stav aktuátorů ze serveru pro vybraný senzor.
// - Poskytuje obsluhu událostí (toggle LED, tlačítka relé, slider setpoint).
// - Zajišťuje synchronizaci UI s backendem a obnovu stavu při změně senzoru.
// - Sleduje DOM pro případ, že main.js nahradí <select> se senzory.
//
// Závislosti:
// - helpers.js (qs, fetchWrappedJson) – qs pro výběr prvků
// - actuatorsApi.js (callLedApi, callRelayApi, callRelaySetpointApi) – vrací čistý result
// - actuatorsUI.js (setLedUI, setRelayUI, setSetpointUI)
// ----------------------------------------------------

import { qs } from './helpers.js';
import { callLedApi, callRelayApi, callRelaySetpointApi } from './actuatorsApi.js';
import { setLedUI, setRelayUI, setSetpointUI } from './actuatorsUI.js';

async function init() {
  const ledToggle = qs('led-toggle');
  const ledStatus = qs('led-status');
  const relayOnBtn = qs('relay-on');
  const relayOffBtn = qs('relay-off');
  const relayAutoBtn = qs('relay-auto');
  const relayModeText = qs('relay-mode');
  const setpoint = qs('setpoint');
  const setpointValue = qs('setpoint-value');


  let sensorSelect = qs('sensor_select');
  if (!sensorSelect) {
    console.error('actuators.js: required select with id "sensor_select" not found in DOM. Actuator UI disabled.');
    return;
  }

  function currentSensorId() {
    const v = sensorSelect.value || null;
    return v;
  }

  let spTimer = null;

  async function loadForCurrentSensor() {
    const sid = currentSensorId();

    if (spTimer) {
      clearTimeout(spTimer);
      spTimer = null;
    }

    // LED
    try {
      if (sid) {
        const ledState = await callLedApi(sid, "GET"); // čistý result
        if (ledState && typeof ledState.logical !== 'undefined') {
          setLedUI(ledState.logical, ledState.hw, ledStatus, ledToggle);
        } else {
          console.warn('[LED] Missing logical in result, applying fallback UI');
          setLedUI(false, null, ledStatus, ledToggle);
        }
      } else {
        setLedUI(false, null, ledStatus, ledToggle);
      }
    } catch (err) {
      console.error('[LED] Error loading state:', err);
      setLedUI(false, null, ledStatus, ledToggle);
    }

    // Relay
    try {
      if (sid) {
        const relayState = await callRelayApi(sid, "GET"); // čistý result
        if (relayState && typeof relayState.mode !== 'undefined') {
          setRelayUI(relayState.mode, relayState.logical, relayState.hw,
                     relayModeText, relayOnBtn, relayOffBtn, relayAutoBtn);
        } else {
          console.warn('[Relay] Missing mode in result, applying fallback UI');
          setRelayUI('auto', false, null, relayModeText, relayOnBtn, relayOffBtn, relayAutoBtn);
        }
      } else {
        setRelayUI('auto', false, null, relayModeText, relayOnBtn, relayOffBtn, relayAutoBtn);
      }
    } catch (err) {
      console.error('[Relay] Error loading state:', err);
      setRelayUI('auto', false, null, relayModeText, relayOnBtn, relayOffBtn, relayAutoBtn);
    }

    // Setpoint
    try {
      if (sid) {
        const sp = await callRelaySetpointApi(sid, "GET"); // čistý result
        if (sp && typeof sp.value !== 'undefined' && sp.value !== null) {
          const v = Number(sp.value);
          setSetpointUI(v, setpointValue, setpoint);
        } else {
          console.warn('[Setpoint] value missing/null, applying UI null');
          setSetpointUI(null, setpointValue, setpoint);
        }
      } else {
        setSetpointUI(null, setpointValue, setpoint);
      }
    } catch (err) {
      console.error('[Setpoint] Error loading state:', err);
      setSetpointUI(null, setpointValue, setpoint);
    }
  }

  // LED toggle listener
  ledToggle?.addEventListener('change', async (ev) => {
    const on = ev.target.checked;
    setLedUI(on, null, ledStatus, ledToggle); // optimistický update
    try {
      const sid = currentSensorId();
      if (!sid) throw new Error("No sensor selected");

      const postState = await callLedApi(sid, "POST", { on }); // čistý result

      const ledState = await callLedApi(sid, "GET"); // čistý result
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

  // Relay mode listener
  async function setRelayMode(mode) {
    const prev = relayModeText ? relayModeText.textContent : '';
    setRelayUI(mode, false, null, relayModeText, relayOnBtn, relayOffBtn, relayAutoBtn);
    try {
      const sid = currentSensorId();
      if (!sid) throw new Error("No sensor selected");
      const postState = await callRelayApi(sid, "POST", { mode }); // čistý result

      const relayState = await callRelayApi(sid, "GET"); // čistý result
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

  // Setpoint slider listener
  if (setpoint) {
    setpoint.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v)) {
        console.warn('[Setpoint] input not finite, ignore');
        return;
      }
      if (setpointValue) setpointValue.textContent = `${v} °C`;
      if (spTimer) {
        clearTimeout(spTimer);
      }
      spTimer = setTimeout(() => {
        sendSetpoint(v);
      }, 600);
    });
  }

  async function sendSetpoint(value) {
    const prev = setpoint ? setpoint.value : null;
    try {
      const sid = currentSensorId();
      if (sid) {
        const postState = await callRelaySetpointApi(sid, "POST", { value: parseFloat(value) }); // čistý result

        const sp = await callRelaySetpointApi(sid, "GET"); // čistý result
        if (sp && typeof sp.value !== 'undefined' && sp.value !== null) {
          const v = Number(sp.value);
          setSetpointUI(v, setpointValue, setpoint);
        } else {
          console.warn('[Setpoint] GET after POST missing/null value, keeping prev');
          if (setpoint) setpoint.value = prev;
        }
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

  await loadForCurrentSensor();

  sensorSelect.addEventListener('change', async () => {
    if (spTimer) {
      clearTimeout(spTimer);
      spTimer = null;
    }
    await loadForCurrentSensor();
  });

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        const newSelect = qs('sensor_select');
        if (newSelect && newSelect !== sensorSelect) {
          sensorSelect = newSelect;
          sensorSelect.addEventListener('change', async () => {
            if (spTimer) {
              clearTimeout(spTimer);
              spTimer = null;
            }
            await loadForCurrentSensor();
          });
          loadForCurrentSensor().catch(e => console.error('[Observer] initial load error', e));
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

document.addEventListener('DOMContentLoaded', init);
export default {};
