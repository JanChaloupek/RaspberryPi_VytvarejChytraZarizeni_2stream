// static/js/actuatorsUI.js
// Modul pro aktualizaci UI prvků aktuátorů.
// ----------------------------------------------------
// Účel:
// - Poskytuje funkce pro vizuální aktualizaci stavu aktuátorů (LED, relé, setpoint).
// - Hodnota (value) je vždy první parametr funkce.
// - DOM elementy se předávají jako argumenty, funkce je znovu nevyhledávají.
// - Odděluje logiku UI od logiky API (čistě prezentační vrstva).
//
// Závislosti:
// - Nepoužívá žádné externí moduly, pouze nativní DOM API.
//
// Funkce:
// - setLedUI(value, ledStatus, ledToggle)
//   → Nastaví text a stav přepínače LED.
// - setRelayUI(value, relayModeText, relayOnBtn, relayOffBtn, relayAutoBtn)
//   → Nastaví text a aktivní tlačítko pro relé.
// - setSetpointUI(value, setpointValue, setpoint)
//   → Nastaví zobrazenou hodnotu a slider pro setpoint.
//
// ----------------------------------------------------

/**
 * setLedUI()
 * ----------------------------------------------------
 * Nastaví stav LED v UI.
 * - Aktualizuje textový popisek (Zapnuto/Vypnuto).
 * - Nastaví stav checkboxu/toggle prvku.
 *
 * @param {boolean} value true = zapnuto, false = vypnuto
 * @param {HTMLElement} ledStatus Element pro textový stav LED
 * @param {HTMLInputElement} ledToggle Checkbox/toggle pro LED
 */
export function setLedUI(value, ledStatus, ledToggle) {
  console.debug('[UI] setLedUI called with', value);
  if (ledStatus) ledStatus.textContent = value ? 'Zapnuto' : 'Vypnuto';
  if (ledToggle) ledToggle.checked = !!value;
}

/**
 * setRelayUI()
 * ----------------------------------------------------
 * Nastaví stav relé v UI.
 * - Aktualizuje textový popisek režimu.
 * - Zvýrazní aktivní tlačítko (On/Off/Auto).
 * - Ostatním tlačítkům odebere třídu "active".
 *
 * @param {'on'|'off'|'auto'} value Režim relé
 * @param {HTMLElement} relayModeText Element pro text režimu
 * @param {HTMLElement} relayOnBtn Tlačítko "On"
 * @param {HTMLElement} relayOffBtn Tlačítko "Off"
 * @param {HTMLElement} relayAutoBtn Tlačítko "Auto"
 */
export function setRelayUI(value, relayModeText, relayOnBtn, relayOffBtn, relayAutoBtn) {
  console.debug('[UI] setRelayUI called with', value);
  if (relayModeText) relayModeText.textContent = `Režim: ${value}`;
  [relayOnBtn, relayOffBtn, relayAutoBtn].forEach(btn => btn?.classList.remove('active'));
  if (value === 'on') relayOnBtn?.classList.add('active');
  if (value === 'off') relayOffBtn?.classList.add('active');
  if (value === 'auto') relayAutoBtn?.classList.add('active');
}

/**
 * setSetpointUI()
 * ----------------------------------------------------
 * Nastaví hodnotu setpointu v UI.
 * - Aktualizuje textovou hodnotu (např. "22 °C").
 * - Nastaví hodnotu slideru/inputu.
 *
 * @param {number|string} value Hodnota setpointu (°C)
 * @param {HTMLElement} setpointValue Element pro zobrazení hodnoty
 * @param {HTMLInputElement} setpoint Slider/input pro setpoint
 */
export function setSetpointUI(value, setpointValue, setpoint) {
  console.debug('[UI] setSetpointUI called with', value);
  if (setpointValue) setpointValue.textContent = `${value} °C`;
  if (setpoint) setpoint.value = value;
}
