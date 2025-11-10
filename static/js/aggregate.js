// static/js/aggregate.js
import { getAggregate } from './api.js';
import { renderBreadcrumb } from './breadcrumb.js';
import { renderTable } from './table.js';
import { translateLevelToCzech } from './utils.js';

// Lokální stav pro aggregate modul
let currentSensor = null;
let currentLevel = null;
let currentKey = null;

export function setAggregateContext(sensor, level, key) {
  currentSensor = sensor;
  currentLevel = level;
  currentKey = key;
}

function updateHistoryNote(level) {
  const el = document.getElementById('history-note');
  if (el) el.textContent = translateLevelToCzech(level);
}

export async function loadAggregate() {
  if (!currentSensor || !currentLevel || !currentKey) {
    console.debug('[aggregate] loadAggregate skipped – missing context', { currentSensor, currentLevel, currentKey });
    return;
  }
  const sensorAtCall = currentSensor;

  renderBreadcrumb(document.getElementById('breadcrumb'), currentLevel, currentKey, (level, key) => {
    console.debug('[aggregate] breadcrumb click', { level, key });
    currentLevel = level;
    currentKey = key;
    loadAggregate();
  });
  updateHistoryNote(currentLevel);

  try {
    const resp = await getAggregate(sensorAtCall, currentLevel, currentKey);
    const rows = resp.result || [];
    renderTable(document.querySelector('table'), rows, currentLevel, (childLevel, childKey) => {
      console.debug('[aggregate] row click', { childLevel, childKey });
      currentLevel = childLevel;
      currentKey = childKey;
      loadAggregate();
    });

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const tz_offset = new Date().getTimezoneOffset() * -1;
    window.dispatchEvent(new CustomEvent('history-range-changed', {
      detail: { sensor_id: sensorAtCall, level: currentLevel, key: currentKey, tz, tz_offset }
    }));
  } catch (e) {
    console.error('loadAggregate failed', e);
    renderTable(document.querySelector('table'), [], currentLevel, () => {});
  }
}
