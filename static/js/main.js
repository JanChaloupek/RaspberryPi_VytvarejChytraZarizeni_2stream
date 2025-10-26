// main.js - init, sensors, update loop + loadAggregate connector
// Předpoklad: utils.js, api.js, breadcrumb.js, table.js, gauges.js jsou načteny před tímto souborem

// Helper: lokalní klíče
function makeLocalDateKey(date = new Date()) {
  const Y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const D = String(date.getDate()).padStart(2, '0');
  return `${Y}-${M}-${D}`; // YYYY-MM-DD
}
function makeYearKey(date = new Date()) { return String(date.getFullYear()); }
function makeMonthKey(date = new Date()) {
  const Y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  return `${Y}-${M}`; // YYYY-MM
}

// Bezpečný loadAggregate: fallback na vybraný sensor v DOM pokud chybí sensor_id
function loadAggregate(sensor_id, level, key, label) {
  if (!sensor_id) {
    const sel = document.getElementById('sensor_select');
    sensor_id = sel ? sel.value : undefined;
  }

  console.info('[loadAggregate] sensor=', sensor_id, 'level=', level, 'key=', key, 'label=', label);

  if (!sensor_id) {
    console.warn('[loadAggregate] missing sensor_id, aborting load');
    return Promise.reject(new Error('missing sensor_id'));
  }

  try {
    // jen pro konkrétní load nechceme přidávat speciální top-level položky automaticky
    // voláme setBreadcrumbForLoad jen pokud chceme přidat novou úroveň (volá volající)
    if (level !== 'yearly' && level !== 'years-list') {
      // pokud voláči posílají breadcrumb předem, setBreadcrumbForLoad může být idempotentní
      // většinou voláme setBreadcrumbForLoad před loadAggregate při navigaci z UI
    }
  } catch (e) {
    console.warn('[loadAggregate] breadcrumb handling failed', e);
  }

  const tzInfo = getClientTzParams();
  const params = new URLSearchParams();
  if (tzInfo.tz) params.set('tz', tzInfo.tz);
  if (typeof tzInfo.offset !== 'undefined' && tzInfo.offset !== null) params.set('tz_offset', String(tzInfo.offset));

  let keyToSend = key;
  try { keyToSend = normalizeLocalKeyForApi(level, key); } catch (e) { keyToSend = key; }

  const url = `/api/aggregate/${encodeURIComponent(sensor_id)}/${encodeURIComponent(level)}/${encodeURIComponent(keyToSend)}?${params.toString()}`;
  console.debug('[fetchAggregate] url=', url, 'sentKey=', keyToSend, 'origKey=', key, 'tzInfo=', tzInfo);

  return fetch(url)
    .then(r => { if (!r.ok) throw new Error('fetchAggregate failed ' + r.status); return r.json(); })
    .then(data => {
      console.debug('[loadAggregate] received rows:', Array.isArray(data) ? data.length : 'non-array', data && data[0]);
      try { renderBreadcrumb(); } catch (e) { console.warn('[loadAggregate] renderBreadcrumb failed', e); }

      try {
        // show table container
        const tableContainer = document.getElementById('history-table-wrap');
        if (tableContainer) tableContainer.style.display = '';
        const yearsContainer = document.getElementById('history-years');
        if (yearsContainer) yearsContainer.style.display = 'none';

        renderHistoryTable(Array.isArray(data) ? data : [], level, sensor_id);
      } catch (e) {
        console.error('[loadAggregate] renderHistoryTable failed', e);
      }
      return data;
    })
    .catch(err => {
      console.error('[loadAggregate] error fetching aggregate:', err);
      throw err;
    });
}

// updateLatest wrapper
function updateLatestWrap(sensor_id) {
  if (!sensor_id) return;
  fetchLatest(sensor_id)
    .then(data => {
      console.debug('[updateLatestWrap] data:', data);
      const temp = parseFloat(data.temperature);
      const hum = parseFloat(data.humidity);
      const tsEl = document.getElementById('timestamp');
      if (tsEl) tsEl.textContent = data.timestamp ? formatTime(data.timestamp) : '--';
      const tempEl = document.getElementById('temperature');
      if (tempEl) tempEl.textContent = isNaN(temp) ? '--' : temp.toFixed(1);
      const humEl = document.getElementById('humidity');
      if (humEl) humEl.textContent = isNaN(hum) ? '--' : hum.toFixed(1);
      if (!isNaN(temp)) setSemiGaugeArc('tempArc', temp, 30, 10);
      if (!isNaN(hum)) setSemiGaugeArc('humArc', hum, 100);
    })
    .catch(err => console.error('[updateLatestWrap] error', err));
}

// updateAll: při startu načíst dnešní den na úrovni hodin a naplnit breadcrumb (Rok->Měsíc->Den)
function updateAll(sensor_id = null) {
  const sensorSelect = document.getElementById("sensor_select");
  const id = sensor_id || (sensorSelect ? sensorSelect.value : null);
  if (!id || id === "undefined") {
    console.warn("[updateAll] missing sensor id");
    return;
  }
  console.info('[updateAll] sensor=', id);
  updateLatestWrap(id);

  // připrav lokální klíče pro dnešek
  const now = new Date();
  const yearKey = makeYearKey(now);       // "2025"
  const monthKey = makeMonthKey(now);     // "2025-10"
  const dayKey = makeLocalDateKey(now);   // "2025-10-26"
  const yearLabel = `Rok: ${yearKey}`;
  const monthLabel = `Měsíc: ${monthKey.split('-')[1]}`;
  const dayLabel = `Den: ${String(dayKey.split('-')[2]).padStart(2,'0')}`;

  // reset breadcrumb and přidat Home + rok + měsíc + den
  breadcrumb = [];
  // pokud renderBreadcrumb očekává speciální Home záznam, uložit ho; jinak renderBreadcrumb by měl vykreslit Home vždy
  breadcrumb.push({ level: 'home', label: 'Home' });
  setBreadcrumbForLoad(id, 'monthly', yearKey, yearLabel);   // Rok: v breadcrumbu jako měsíční úroveň (po kliknutí se zobrazí měsíce)
  setBreadcrumbForLoad(id, 'daily', monthKey, `Měsíc: ${monthKey.split('-')[1]}`);
  setBreadcrumbForLoad(id, 'hourly', dayKey, dayLabel);      // Den: ... (první skutečná úroveň uživatelské navigace)

  // nastav currentAggregate a načti hourly view pro dnešek
  currentAggregate = { sensor_id: id, level: 'hourly', key: dayKey, label: dayLabel };
  loadAggregate(id, 'hourly', dayKey, dayLabel).catch(()=>{ /* already logged */ });
}

// sensors init
function loadSensorsInit() {
  const sensorSelect = document.getElementById("sensor_select");
  if (!sensorSelect) {
    console.warn("[loadSensorsInit] #sensor_select not found");
    return;
  }
  fetchSensors()
    .then(sensors => {
      console.debug('[loadSensorsInit] sensors:', sensors);
      sensorSelect.innerHTML = "";
      sensors.forEach(sensor => {
        const option = document.createElement("option");
        option.value = sensor.id;
        option.textContent = sensor.name;
        sensorSelect.appendChild(option);
      });
      const lastSensor = localStorage.getItem("lastSensor");
      const validSensor = sensors.find(s => s.id === lastSensor);
      const defaultSensor = validSensor ? validSensor.id : sensors[0]?.id;
      if (defaultSensor) {
        sensorSelect.value = defaultSensor;
        updateAll(defaultSensor);
      } else {
        console.warn('[loadSensorsInit] no default sensor found');
      }
    })
    .catch(err => console.error('[loadSensorsInit] error', err));
}

// DOM ready init
document.addEventListener('DOMContentLoaded', () => {
  console.info("[main] DOM ready");
  const sensorSelect = document.getElementById("sensor_select");
  const homeBtn = document.getElementById("home_btn");
  if (!sensorSelect) {
    console.warn("[main] #sensor_select not found");
    return;
  }

  sensorSelect.addEventListener('change', () => {
    const selected = sensorSelect.value;
    localStorage.setItem("lastSensor", selected);
    updateAll(selected);
  });

  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      // Home vrací na měsíční přehled pro aktuální rok (tak jak jsi chtěl zachovat)
      const selected = document.getElementById("sensor_select")?.value;
      if (selected) {
        breadcrumb = [];
        const now = new Date();
        const yearKey = makeYearKey(now);
        const yearLabel = `Rok: ${yearKey}`;
        // použij monthly top-level (seznam měsíců pro daný rok)
        setBreadcrumbForLoad(selected, 'monthly', yearKey, yearLabel);
        currentAggregate = { sensor_id: selected, level: 'monthly', key: yearKey, label: yearLabel };
        loadAggregate(selected, 'monthly', yearKey, yearLabel).catch(()=>{});
      }
    });
  }

  loadSensorsInit();

  // periodicky refresh latest a (pokud existuje) reload aktuální aggregate
//  setInterval(() => {
//    const selected = document.getElementById("sensor_select")?.value;
//    if (selected) {
//      updateLatestWrap(selected);
//      if (typeof currentAggregate !== 'undefined' && currentAggregate && currentAggregate.sensor_id === selected) {
//        // znovu načíst aktuální agregaci (pokud to není yearly top-level)
//        if (currentAggregate.level && currentAggregate.level !== 'yearly') {
//          loadAggregate(currentAggregate.sensor_id, currentAggregate.level, currentAggregate.key, currentAggregate.label).catch(()=>{});
//        }
//      }
//    }
//  }, 5000);
});
