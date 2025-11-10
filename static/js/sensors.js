// static/js/sensors.js
import { getSensors } from './api.js';
import { renderTable } from './table.js';
import { setGaugeValue } from './gauges.js';
import { todayKey } from './utils.js';
import { loadLatest } from './latest.js';
import { loadAggregate, setAggregateContext } from './aggregate.js';

export let currentSensor = null;
export let currentLevel = 'hourly';
export let currentKey = todayKey();

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
