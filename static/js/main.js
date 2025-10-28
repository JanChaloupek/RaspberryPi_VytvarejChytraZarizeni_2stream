// static/js/main.js
// Single entrypoint module. Imports other modules (utils, api, breadcrumb, table, gauges).
import { parseLocalKey, nextLevel } from './utils.js';
import { getSensors, getLatest, getAggregate } from './api.js';
import { renderBreadcrumb } from './breadcrumb.js';
import { renderTable } from './table.js';
import { setGaugeValue } from './gauges.js';
import { updateSnapshotFromIso } from './snapshot.js';

let currentSensor = null;
// výchozí nyní 'hourly' pro zobrazení hodinových průměrů v aktuálním dni
let currentLevel = 'hourly';
let currentKey = null;
let currentTz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`; // YYYY-MM-DD
}

async function loadSensors() {
  console.debug('[main] loadSensors start');
  try {
    const sensors = await getSensors();
    console.debug('[main] sensors received:', sensors);
    const sel = document.getElementById('sensor_select');
    // remove existing listeners safely by replacing element
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
      const newSensor = ev.target.value;
      console.info('[main] select changed ->', newSensor);
      currentSensor = newSensor;
      // po změně senzoru se vracíme na dnešní den a hodinové agregace
      currentLevel = 'hourly';
      currentKey = todayKey();
      newSel.value = currentSensor;
      await loadLatest();
      await loadAggregate();
    });

    if (sensors.length) {
      currentSensor = sensors[0].id;
      // initial key = today (hodinové řádky)
      currentLevel = 'hourly';
      currentKey = todayKey();
      newSel.value = currentSensor;
      console.info('[main] initial sensor set ->', currentSensor, 'initial view ->', currentLevel, currentKey);
      // initial load after DOM update
      await loadLatest();
      await loadAggregate();
    } else {
      // no sensors: clear UI
      currentSensor = null;
      // document.getElementById('timestamp').textContent = '--';
      setGaugeValue('tempArc', 'temperature', null);
      setGaugeValue('humArc', 'humidity', null);
      renderTable(document.querySelector('table'), [], currentLevel, () => {});
    }
  } catch (e) {
    console.error('[main] loadSensors failed:', e);
  }
}

async function loadLatest() {
  if (!currentSensor) {
    console.debug('[main] loadLatest skipped - no currentSensor');
    return;
  }
  const sensorAtCall = currentSensor;
  console.debug('[main] loadLatest start for sensorAtCall=', sensorAtCall);
  try {
    const latest = await getLatest(sensorAtCall);

    // pokud mezitím už uživatel změnil senzor, ignoruj tuto odpověď
    if (currentSensor !== sensorAtCall) {
      console.debug('Ignored stale latest response for', sensorAtCall, 'current is', currentSensor);
      return;
    }

    if (!latest || Object.keys(latest).length === 0) {
      // document.getElementById('timestamp').textContent = '--';
      setGaugeValue('tempArc', 'temperature', null);
      setGaugeValue('humArc', 'humidity', null);
      return;
    }

    // API timestamp expected as 'YYYY-MM-DD HH:MM:SS' (UTC) or ISO-like string.
    let tsRaw = String(latest.timestamp || '');
    tsRaw = tsRaw.replace(' ', 'T');
    const hasTZ = /Z|[+\-]\d{2}:\d{2}$/.test(tsRaw);
    const tsIso = hasTZ ? tsRaw : (tsRaw + 'Z');

    const ts = new Date(tsIso);
    updateSnapshotFromIso(tsIso);

    const tempVal = (latest.temperature === null || latest.temperature === undefined) ? null : Number(latest.temperature);
    const humVal = (latest.humidity === null || latest.humidity === undefined) ? null : Number(latest.humidity);

    setGaugeValue('tempArc', 'temperature', Number.isFinite(tempVal) ? tempVal : null, -20, 50);
    setGaugeValue('humArc', 'humidity', Number.isFinite(humVal) ? humVal : null, 0, 100);
  } catch (e) {
    if (e.name === 'AbortError') {
      return;
    }
    console.error('Failed to load latest', e);
    if (currentSensor === sensorAtCall) {
      // document.getElementById('timestamp').textContent = '--';
      setGaugeValue('tempArc', 'temperature', null);
      setGaugeValue('humArc', 'humidity', null);
    }
  }
}

function onNavigate(level, key) {
  console.debug('[main] onNavigate ->', level, key);
  currentLevel = level;
  currentKey = key;
  loadAggregate();
}

async function loadAggregate() {
  if (!currentSensor || !currentLevel || !currentKey) {
    console.debug('[main] loadAggregate skipped - missing params', {currentSensor, currentLevel, currentKey});
    return;
  }
  const sensorAtCall = currentSensor;
  console.debug('[main] loadAggregate start', {sensorAtCall, level: currentLevel, key: currentKey, tz: currentTz});

  const bc = document.getElementById('breadcrumb');
  renderBreadcrumb(bc, currentLevel, currentKey, onNavigate);

  try {
    const resp = await getAggregate(sensorAtCall, currentLevel, currentKey, currentTz, null);
    console.debug('[main] aggregate response for', sensorAtCall, resp);

    if (resp && resp.query && resp.query.sensor_id && resp.query.sensor_id !== sensorAtCall) {
      console.debug('Ignored aggregate response for', resp.query.sensor_id, 'expected', sensorAtCall);
      return;
    }

    if (currentSensor !== sensorAtCall) {
      console.debug('Ignored stale aggregate response for', sensorAtCall, 'current is', currentSensor);
      return;
    }

    const rows = resp.result || [];
    console.info(`[main] rendering table for sensor=${sensorAtCall} level=${currentLevel} rows=${rows.length}`);
    const tableRoot = document.querySelector('table');
    renderTable(tableRoot, rows, currentLevel, (childLevel, childKey) => {
      console.debug('[main] row clicked -> drilldown to', childLevel, childKey);
      currentLevel = childLevel;
      currentKey = childKey;
      loadAggregate();
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      return;
    }
    console.error('[main] loadAggregate failed for', sensorAtCall, e);
    const tableRoot = document.querySelector('table');
    renderTable(tableRoot, [], currentLevel, () => {});
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  console.debug('[main] DOMContentLoaded -> bootstrap app');
  await loadSensors();
});


// Interval automatického načítání v milisekundách (10 sekund)
const AUTO_REFRESH_MS = 10_000;

// Interní proměnné pro ID intervalu a zámek
let __autoRefreshId = null;
let __isRefreshing = false;

async function callAppRefresh() {
  // nechceme spouštět nové refresh pokud už probíhá
  if (__isRefreshing) return true;
  if (!currentSensor) {
    // pokud není vybraný senzor, nic neobnovujeme a vrátíme false aby se případně stoplo
    return false;
  }
  __isRefreshing = true;
  try {
    // aktualizujeme latest i agregát (agregát může případně interně ignorovat duplicitní odpovědi)
    await loadLatest();
    await loadAggregate();
    return true;
  } catch (e) {
    console.error('Auto-refresh internal error', e);
    return true; // i při chybě pokračujeme další intervalem
  } finally {
    __isRefreshing = false;
  }
}

export function startAutoRefresh() {
  if (__autoRefreshId !== null) return;
  // Ihned jednorázově zavolat (ale neblokovat UI)
  callAppRefresh().catch(e => console.error(e));
  __autoRefreshId = window.setInterval(() => {
    callAppRefresh().then(ok => {
      // pokud vrací false (např. žádný sensor), zastavíme auto-refresh
      if (!ok) {
        console.warn('Auto-refresh: no sensor selected — stopping auto-refresh');
        stopAutoRefresh();
      }
    }).catch(err => {
      console.error('Auto-refresh failed', err);
    });
  }, AUTO_REFRESH_MS);
}

export function stopAutoRefresh() {
  if (__autoRefreshId !== null) {
    clearInterval(__autoRefreshId);
    __autoRefreshId = null;
  }
}

// Spustit automaticky při načtení skriptu
startAutoRefresh();
