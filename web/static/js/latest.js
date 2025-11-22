// static/js/latest.js
// Modul pro načítání posledních hodnot senzoru a aktualizaci gauge.
// ----------------------------------------------------
// Účel:
// - Získává poslední hodnoty z API pro aktuálně vybraný senzor.
// - Aktualizuje snapshot a gauge (teplota, vlhkost, rosný bod).
// - Ošetřuje race condition při změně senzoru během volání.
// - Při chybě nebo prázdných datech nastavuje gauge na null.
//
// Závislosti:
// - api.js (funkce getLatest)
// - gauges.js (funkce setGaugeValue)
// - snapshot.js (funkce updateSnapshotFromIso)
// - sensors.js (proměnná currentSensor)
//
// Funkce:
// - loadLatest()
//   → Hlavní API pro načtení posledních hodnot a aktualizaci UI.
//   → Postup:
//      1. Ověří, zda je nastavený currentSensor (jinak funkci přeskočí).
//      2. Zavolá API getLatest(sensorId) a získá poslední hodnoty.
//      3. Pokud se mezitím změnil currentSensor, výsledek se ignoruje (ochrana proti race condition).
//      4. Pokud API vrátí prázdná data:
//         - Nastaví všechny gauge (teplota, vlhkost, rosný bod) na null → zobrazí se "--".
//      5. Pokud API vrátí data:
//         - Normalizuje timestamp na ISO formát (přidá 'Z' pokud chybí časová zóna).
//         - Zavolá updateSnapshotFromIso() pro aktualizaci snapshotu.
//         - Převede hodnoty temperature, humidity, dew_point na čísla.
//         - Nastaví gauge:
//             - Teplota: rozsah -20 až 50 °C
//             - Vlhkost: rozsah 0 až 100 %
//             - Rosný bod: rozsah -20 až 30 °C
//      6. Pokud dojde k chybě:
//         - Zaloguji chybu do konzole.
//         - Nastaví všechny gauge na null.
//
// ----------------------------------------------------

import { getLatest } from './api.js';
import { setGaugeValue } from './gauges.js';
import { updateSnapshotFromIso } from './snapshot.js';
import { currentSensor } from './sensors.js';

/**
 * loadLatest()
 * ----------------------------------------------------
 * Načte poslední hodnoty pro aktuálně vybraný senzor a aktualizuje UI gauge.
 *
 * @returns {Promise<void>}
 */
export async function loadLatest() {
  if (!currentSensor) return; // žádný senzor není vybraný
  const sensorAtCall = currentSensor;
  try {
    const latest = await getLatest(sensorAtCall);
    if (currentSensor !== sensorAtCall) return; // ochrana proti změně senzoru během volání

    // fallback pro prázdná data
    if (!latest || Object.keys(latest).length === 0) {
      setGaugeValue('tempArc', 'temperature', null);
      setGaugeValue('humArc', 'humidity', null);
      setGaugeValue('dewArc', 'dew_point', null);
      return;
    }

    // normalizace timestampu na ISO formát
    let tsRaw = String(latest.timestamp || '').replace(' ', 'T');
    const tsIso = /Z|[+\-]\d{2}:\d{2}$/.test(tsRaw) ? tsRaw : (tsRaw + 'Z');
    updateSnapshotFromIso(tsIso);

    // převod hodnot na čísla
    const tempVal = Number(latest.temperature);
    const humVal = Number(latest.humidity);
    const dewVal = Number(latest.dew_point);

    // nastavení gauge s validací hodnot
    setGaugeValue('tempArc', 'temperature', Number.isFinite(tempVal) ? tempVal : null, -20, 50);
    setGaugeValue('humArc', 'humidity', Number.isFinite(humVal) ? humVal : null, 0, 100);
    setGaugeValue('dewArc', 'dew_point', Number.isFinite(dewVal) ? dewVal : null, -20, 30);
  } catch (e) {
    console.error('Failed to load latest', e);
    // fallback při chybě – všechny gauge na null
    setGaugeValue('tempArc', 'temperature', null);
    setGaugeValue('humArc', 'humidity', null);
    setGaugeValue('dewArc', 'dew_point', null);
  }
}
