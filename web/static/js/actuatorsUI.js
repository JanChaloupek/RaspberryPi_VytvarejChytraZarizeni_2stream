// static/js/actuatorsUI.js
// Modul pro aktualizaci UI prvků aktuátorů.
// ----------------------------------------------------
// Účel:
// - Poskytuje funkce pro vizuální aktualizaci stavu aktuátorů (LED, relé, setpoint).
// - Hodnoty (logical, hw, mode) jsou předávány jako parametry.
// - DOM elementy se předávají jako argumenty, funkce je znovu nevyhledávají.
// - Odděluje logiku UI od logiky API (čistě prezentační vrstva).
// ----------------------------------------------------

/**
 * setLedUI()
 * ----------------------------------------------------
 * Nastaví stav LED v UI.
 * - Aktualizuje textový popisek (Logický/HW).
 * - Nastaví stav checkboxu/toggle prvku podle logického stavu.
 * - Pokud hw === null → zobrazí "?".
 *
 * @param {boolean} logical Logický stav LED
 * @param {boolean|null} hw Skutečný HW stav LED (true/false nebo null pokud není pin)
 * @param {HTMLElement} ledStatus Element pro textový stav LED
 * @param {HTMLInputElement} ledToggle Checkbox/toggle pro LED
 */
export function setLedUI(logical, hw, ledStatus, ledToggle) {
  console.info('[UI] setLedUI', { logical, hw });
  if (ledStatus) {
    const hwText = hw === null ? '?' : (hw ? 'Zapnuto' : 'Vypnuto');
    ledStatus.textContent = `Logický: ${logical ? 'Zapnuto' : 'Vypnuto'}, HW: ${hwText}`;
  }
  if (ledToggle) ledToggle.checked = !!logical;
}

/**
 * setRelayUI()
 * ----------------------------------------------------
 * Nastaví stav relé v UI.
 * - Aktualizuje textový popisek (Režim + Logický + HW).
 * - Zvýrazní aktivní tlačítko (On/Off/Auto).
 * - Pokud hw === null → zobrazí "?".
 *
 * @param {'on'|'off'|'auto'} mode Režim relé
 * @param {boolean} logical Logický stav relé
 * @param {boolean|null} hw Skutečný HW stav relé (true/false nebo null pokud není pin)
 * @param {HTMLElement} relayModeText Element pro text režimu
 * @param {HTMLElement} relayOnBtn Tlačítko "On"
 * @param {HTMLElement} relayOffBtn Tlačítko "Off"
 * @param {HTMLElement} relayAutoBtn Tlačítko "Auto"
 */
export function setRelayUI(mode, logical, hw, relayModeText, relayOnBtn, relayOffBtn, relayAutoBtn) {
  console.info('[UI] setRelayUI', { mode, logical, hw });
  if (relayModeText) {
    const hwText = hw === null ? '?' : (hw ? 'ON' : 'OFF');
    relayModeText.textContent = `Režim: ${mode}, Logický: ${logical ? 'ON' : 'OFF'}, HW: ${hwText}`;
  }
  [relayOnBtn, relayOffBtn, relayAutoBtn].forEach(btn => btn?.classList.remove('active'));
  if (mode === 'on') relayOnBtn?.classList.add('active');
  if (mode === 'off') relayOffBtn?.classList.add('active');
  if (mode === 'auto') relayAutoBtn?.classList.add('active');
}

/**
 * setSetpointUI()
 * ----------------------------------------------------
 * Nastaví hodnotu setpointu v UI.
 * - Aktualizuje textovou hodnotu (např. "22 °C").
 * - Nastaví hodnotu slideru/inputu.
 * - Pokud value === null → zobrazí "- °C".
 *
 * @param {number|string|null} value Hodnota setpointu (°C)
 * @param {HTMLElement} setpointValue Element pro zobrazení hodnoty
 * @param {HTMLInputElement} setpoint Slider/input pro setpoint
 */
export function setSetpointUI(value, setpointValue, setpoint) {
  console.info('[UI] setSetpointUI', { value });
  const displayValue = (value === null || value === undefined) ? '-' : value;
  if (setpointValue) setpointValue.textContent = `${displayValue} °C`;
  if (setpoint && displayValue !== '-') setpoint.value = displayValue;
}
