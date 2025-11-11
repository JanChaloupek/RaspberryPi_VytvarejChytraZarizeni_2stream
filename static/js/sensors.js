// static/js/sensors.js
// Modul pro správu senzorů na dashboardu.
// ----------------------------------------------------
// Účel:
// - Načítá seznam dostupných senzorů z API.
// - Plní <select id="sensor_select"> možnostmi senzorů.
// - Udržuje stav aktuálně vybraného senzoru (currentSensor),
//   úroveň agregace (currentLevel) a klíč (currentKey).
// - Při změně senzoru nastavuje kontext pro modul aggregate,
//   a spouští načtení aktuálních i agregovaných dat.
// - Pokud nejsou dostupné žádné senzory, resetuje gauge a tabulku.
//
// Závislosti:
// - api.js (getSensors)
// - table.js (renderTable)
// - gauges.js (setGaugeValue)
// - utils.js (todayKey)
// - latest.js (loadLatest)
// - aggregate.js (loadAggregate, setAggregateContext)
//
// Exportované proměnné:
// - currentSensor: ID aktuálně vybraného senzoru (nebo null)
// - currentLevel: úroveň agregace (default 'hourly')
// - currentKey: časový klíč (default dnešní datum)

import { getSensors } from './api.js';
import { renderTable } from './table.js';
import { setGaugeValue } from './gauges.js';
import { todayKey } from './utils.js';
import { loadLatest } from './latest.js';
import { loadAggregate, setAggregateContext } from './aggregate.js';

export let currentSensor = null;
export let currentLevel = 'hourly';
export let currentKey = todayKey();

/**
 * loadSensors()
 * ----------------------------------------------------
 * Načte seznam senzorů z API a aktualizuje <select id="sensor_select">.
 * - Pokud jsou senzory dostupné:
 *   - Naplní select možnostmi.
 *   - Nastaví první senzor jako aktuální.
 *   - Nastaví kontext pro modul aggregate.
 *   - Spustí načtení aktuálních i agregovaných dat.
 * - Pokud nejsou senzory dostupné:
 *   - Resetuje gauge hodnoty na null.
 *   - Vykreslí prázdnou tabulku.
 * - Přidává listener na změnu senzoru, který provede stejnou inicializaci.
 *
 * @returns {Promise<void>}
 */
export async function loadSensors() {
  console.debug('[sensors] loadSensors start');
  try {
    const sensors = await getSensors();
    const sel = document.getElementById('sensor_select');
    const newSel = sel.cloneNode(false);
    sel.parentNode.replaceChild(newSel, sel);

    newSel.innerHTML = '';
    sensors.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name || s.id;
      newSel.appendChild(opt);
    });

    newSel.addEventListener('change', async (ev) => {
      currentSensor = ev.target.value;
      currentLevel = 'hourly';
      currentKey = todayKey();

      // nastavíme kontext pro aggregate modul
      setAggregateContext(currentSensor, currentLevel, currentKey);

      await loadLatest();
      await loadAggregate();
    });

    if (sensors.length) {
      currentSensor = sensors[0].id;
      currentLevel = 'hourly';
      currentKey = todayKey();
      newSel.value = currentSensor;

      // nastavíme kontext pro aggregate modul
      setAggregateContext(currentSensor, currentLevel, currentKey);

      await loadLatest();
      await loadAggregate();
    } else {
      currentSensor = null;
      setGaugeValue('tempArc', 'temperature', null);
      setGaugeValue('humArc', 'humidity', null);
      renderTable(document.querySelector('table'), [], currentLevel, () => {});
    }
  } catch (e) {
    console.error('[sensors] loadSensors failed:', e);
  }
}
