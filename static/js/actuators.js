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
// - helpers.js (qs, getQueryParam, actorForSensor, fetchWrappedJson)
// - actuatorsApi.js (callActorApi, callSetpointApi)
// - actuatorsUI.js (setLedUI, setRelayUI, setSetpointUI)
//
// Konfigurace:
// - API_BASE = '/api/actuators' (základní cesta pro REST API)
//
// Funkce:
// - init() → hlavní inicializace UI, binding událostí, načtení stavu.
// - currentSensorId() → vrací ID aktuálně vybraného senzoru (s ohledem na query param).
// - getActor(kind) → mapuje senzor na konkrétní aktuátor (LED/relay).
// - loadForCurrentSensor() → načte stav LED, relé a setpoint pro aktuální senzor.
// - setRelayMode(mode) → nastaví režim relé (on/off/auto) s fallbackem při chybě.
// - sendSetpoint(value) → odešle hodnotu setpointu na server, s fallbackem při chybě.
// - DOM event listenery: změna LED, kliknutí na tlačítka relé, posun slideru setpoint.
// - MutationObserver → sleduje DOM pro případ nahrazení <select> se senzory a rebinding.
//
// ----------------------------------------------------

import { qs, getQueryParam, actorForSensor, fetchWrappedJson } from './helpers.js';
import { callActorApi, callSetpointApi } from './actuatorsApi.js';
import { setLedUI, setRelayUI, setSetpointUI } from './actuatorsUI.js';

const API_BASE = '/api/actuators';

/**
 * init()
 * ----------------------------------------------------
 * Hlavní inicializační funkce modulu.
 * - Najde potřebné DOM prvky (LED toggle, relay buttons, setpoint slider).
 * - Ověří existenci <select> se senzory (id "sensor_select"); bez něj se UI aktuátorů vypne.
 * - Načte stav aktuátorů pro aktuální senzor a připojí event listenery.
 * - Spustí MutationObserver pro sledování případné výměny <select> v DOM (např. main.js).
 *
 * @returns {Promise<void>}
 */
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

  /**
   * currentSensorId()
   * ----------------------------------------------------
   * Vrací ID aktuálně vybraného senzoru z <select>.
   * - Pokud je v URL query param "actor" (override), vrací null (mapování aktuátoru je řízeno override).
   *
   * @returns {string|null} ID senzoru nebo null při override
   */
  function currentSensorId() {
    const override = getQueryParam('actor');
    if (override) return null;
    return sensorSelect.value || null;
  }

  /**
   * getActor(kind)
   * ----------------------------------------------------
   * Vrátí identifikátor aktuátoru dle aktuálního senzoru a typu aktuátoru.
   * - Umožňuje override přes query param "actor".
   *
   * @param {('led'|'relay')} [kind="led"] Typ aktuátoru
   * @returns {string|null} Identifikátor aktuátoru (např. "/api/actuators/relay/xyz") nebo null
   */
  function getActor(kind = "led") {
    const override = getQueryParam('actor');
    const sid = currentSensorId();
    return actorForSensor(sid, kind, override);
  }

  /**
   * loadForCurrentSensor()
   * ----------------------------------------------------
   * Načte a nastaví UI stav pro LED, relé a setpoint podle aktuálního senzoru.
   * - Každá část je samostatně chráněna try/catch, aby chyba jednoho aktuátoru nezablokovala ostatní.
   * - Při nedostupném aktuátoru nebo chybě nastaví bezpečný default (LED off, relay auto, setpoint null).
   *
   * @returns {Promise<void>}
   */
  async function loadForCurrentSensor() {
    // LED
    try {
      const actorLed = getActor("led");
      if (actorLed) {
        const ledState = await callActorApi(actorLed, "GET");
        if (ledState && typeof ledState.on !== 'undefined') {
          setLedUI(ledState.on, ledStatus, ledToggle);
        }
      } else {
        setLedUI(false, ledStatus, ledToggle);
      }
    } catch {
      setLedUI(false, ledStatus, ledToggle);
    }

    // Relay mode
    try {
      const actorRelay = getActor("relay");
      if (actorRelay) {
        const relayState = await callActorApi(actorRelay, "GET");
        if (relayState && relayState.mode) {
          setRelayUI(relayState.mode, relayModeText, relayOnBtn, relayOffBtn, relayAutoBtn);
        }
      } else {
        setRelayUI('auto', relayModeText, relayOnBtn, relayOffBtn, relayAutoBtn);
      }
    } catch {
      setRelayUI('auto', relayModeText, relayOnBtn, relayOffBtn, relayAutoBtn);
    }

    // Setpoint
    try {
      const actorRelay = getActor("relay");
      if (actorRelay) {
        const sp = await callSetpointApi(actorRelay, "GET");
        if (sp && typeof sp.value !== 'undefined') {
          setSetpointUI(sp.value, setpointValue, setpoint);
        }
      } else {
        setSetpointUI(null, setpointValue, setpoint);
      }
    } catch {
      setSetpointUI(null, setpointValue, setpoint);
    }
  }

  await loadForCurrentSensor();

  // LED toggle
  if (ledToggle) {
    /**
     * Event listener: změna stavu LED přepínače.
     * - Optimisticky aktualizuje UI dle nové hodnoty.
     * - Odešle změnu na API; při chybě vrátí UI zpět a upozorní uživatele.
     *
     * @param {Event} ev Change event z checkboxu
     */
    ledToggle.addEventListener('change', async (ev) => {
      const on = ev.target.checked;
      setLedUI(on, ledStatus, ledToggle);
      try {
        const actor = getActor("led");
        if (!actor) throw new Error("No actor mapped for selected sensor");
        await callActorApi(actor, "POST", { on });
      } catch {
        setLedUI(!on, ledStatus, ledToggle);
        alert('Chyba: nelze změnit stav LED');
      }
    });
  }

  /**
   * setRelayMode(mode)
   * ----------------------------------------------------
   * Nastaví režim relé (on/off/auto) s optimistickou aktualizací UI.
   * - Při chybě obnoví předchozí zobrazený režim, zobrazí alert a pokusí se znovu načíst stav relé.
   *
   * @param {('on'|'off'|'auto')} mode Nový režim relé
   * @returns {Promise<void>}
   */
  async function setRelayMode(mode) {
    const prev = relayModeText ? relayModeText.textContent : '';
    setRelayUI(mode, relayModeText, relayOnBtn, relayOffBtn, relayAutoBtn);
    try {
      const actor = getActor("relay");
      if (!actor) throw new Error("No relay mapped for selected sensor");
      await callActorApi(actor, "POST", { mode });
    } catch {
      if (relayModeText) relayModeText.textContent = prev;
      alert('Chyba: nelze změnit režim relé');
      try {
        const actor = getActor("relay");
        if (actor) {
          const s = await callActorApi(actor, "GET");
          if (s && s.mode) setRelayUI(s.mode, relayModeText, relayOnBtn, relayOffBtn, relayAutoBtn);
        }
      } catch {}
    }
  }
  // Relay buttons listeners
  relayOnBtn?.addEventListener('click', () => setRelayMode('on'));
  relayOffBtn?.addEventListener('click', () => setRelayMode('off'));
  relayAutoBtn?.addEventListener('click', () => setRelayMode('auto'));

  // Setpoint slider
  let spTimer = null;
  if (setpoint) {
    /**
     * Event listener: vstup setpoint slideru.
     * - Aktualizuje zobrazenou hodnotu.
     * - Používá debounce 600 ms k omezení počtu POST požadavků.
     *
     * @param {Event} e Input event ze slideru
     */
    setpoint.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (setpointValue) setpointValue.textContent = `${v} °C`;
      if (spTimer) clearTimeout(spTimer);
      spTimer = setTimeout(() => sendSetpoint(v), 600);
    });
  }

  /**
   * sendSetpoint(value)
   * ----------------------------------------------------
   * Odešle novou hodnotu setpointu na server.
   * - Preferuje mapovaný relay-actor; pokud není, použije fallback endpoint `${API_BASE}/setpoint`.
   * - Při chybě upozorní uživatele a pokusí se obnovit UI načtením skutečné hodnoty ze serveru.
   * - Pokud obnova selže, vrátí slider na předchozí hodnotu.
   *
   * @param {number|string} value Hodnota setpointu (°C)
   * @returns {Promise<void>}
   */
  async function sendSetpoint(value) {
    const prev = setpoint ? setpoint.value : null;
    try {
      const actor = getActor("relay");
      if (actor) {
        await callSetpointApi(actor, "POST", { value: parseFloat(value) });
      } else {
        await fetchWrappedJson(`${API_BASE}/setpoint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: parseFloat(value) })
        });
      }
    } catch {
      alert('Chyba: nelze uložit setpoint');
      try {
        const actor = getActor("relay");
        if (actor) {
          const s = await callSetpointApi(actor, "GET");
          if (s && typeof s.value !== 'undefined') {
            setSetpointUI(s.value, setpointValue, setpoint);
          } else if (setpoint) {
            setpoint.value = prev;
          }
        } else {
          const s = await fetchWrappedJson(`${API_BASE}/setpoint`);
          if (s && typeof s.value !== 'undefined') {
            setSetpointUI(s.value, setpointValue, setpoint);
          } else if (setpoint) {
            setpoint.value = prev;
          }
        }
      } catch {
        if (setpoint) setpoint.value = prev;
      }
    }
  }

  /**
   * Event listener: změna vybraného senzoru v <select>.
   * - Po změně senzoru znovu načte stavy aktuátorů pro nově vybraný senzor.
   */
  sensorSelect.addEventListener('change', async () => {
    await loadForCurrentSensor();
  });

  /**
   * MutationObserver pro sledování DOM
   * ----------------------------------------------------
   * Sleduje dokument pro případ, že hlavní logika (např. main.js) nahradí element <select id="sensor_select">.
   * - Při detekci nového selectu provede rebinding event listeneru a okamžité načtení stavů.
   */
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        const newSelect = qs('sensor_select');
        if (newSelect && newSelect !== sensorSelect) {
          sensorSelect = newSelect;
          sensorSelect.addEventListener('change', async () => { await loadForCurrentSensor(); });
          loadForCurrentSensor().catch(e => console.error(e));
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * document.addEventListener('DOMContentLoaded', init)
 * ----------------------------------------------------
 * Registruje inicializaci modulu po kompletním načtení DOMu.
 * - Zajišťuje, že selektory a UI prvky existují při startu logiky.
 */
document.addEventListener('DOMContentLoaded', init);

/**
 * export default {}
 * ----------------------------------------------------
 * Exportuje prázdný objekt jako default export.
 * - Umožňuje konzistentní import modulu i tam, kde se očekává default export.
 * - Nezpřístupňuje žádné runtime API; modul se inicializuje přes DOMContentLoaded.
 */
export default {};