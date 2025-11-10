// static/js/plot.js
// Naslouchá 'history-range-changed', volá /api/aggregate a vykreslí Plotly graf.
// Přizpůsobeno API odpovědi: { query: {...}, result: [ {...}, ... ] }

import { formatKeyForCzechDisplay, parentLevel } from './utils.js';

const plotContainer = document.getElementById('plot-container');
const plotRefreshBtn = document.getElementById('plot-refresh');
const plotTypeSelect = document.getElementById('plot-type');
const plotRangeLabel = document.getElementById('plot-range');
const sensorSelect = document.getElementById('sensor_select');

let lastParams = null;

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function buildAggregateUrl(params) {
  const { sensor_id, level, key, tz, tz_offset } = params;
  const q = new URLSearchParams();
  if (tz) q.set('tz', tz);
  if (tz_offset !== undefined && tz_offset !== null) q.set('tz_offset', tz_offset);
  return `/api/aggregate/${encodeURIComponent(sensor_id)}/${encodeURIComponent(level)}/${encodeURIComponent(key)}?${q.toString()}`;
}

function normalizeRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { x: [], temp: null, hum: null, timeKey: null };
  const sample = rows[0];
  const keys = Object.keys(sample);
  const timeKey = keys.find(k => /^(ts|time|timestamp|key|date)$/i.test(k)) || keys[0];

  const hasTemp = keys.includes('temperature') || keys.includes('temp');
  const hasHum = keys.includes('humidity') || keys.includes('hum');

  const x = rows.map(r => r[timeKey]);
  const temp = hasTemp ? rows.map(r => {
    const v = r.temperature !== undefined ? r.temperature : r.temp;
    return v === null || v === undefined ? null : Number(v);
  }) : null;
  const hum = hasHum ? rows.map(r => {
    const v = r.humidity !== undefined ? r.humidity : r.hum;
    return v === null || v === undefined ? null : Number(v);
  }) : null;

  return { x, temp, hum, timeKey };
}

function toDateIfIso(v) {
  if (v instanceof Date) return v;
  if (v === null || v === undefined) return v;
  const d = new Date(v);
  return isNaN(d) ? v : d;
}

function ensurePlotlyOrShowError() {
  if (typeof Plotly === 'undefined') {
    plotRangeLabel.textContent = 'Plotly není načten';
    console.error('Plotly is not defined. Ensure Plotly CDN script is included before plot.js');
    return false;
  }
  return true;
}

function renderPlot(normalized, params) {
  if (!ensurePlotlyOrShowError()) return;

  const plotType = plotTypeSelect?.value || 'line';
  const traces = [];

  if (normalized.temp) {
    traces.push({
      x: normalized.x.map(toDateIfIso),
      y: normalized.temp,
      name: 'Teplota',
      yaxis: 'y1',
      type: plotType === 'line' ? 'scatter' : plotType,
      mode: plotType === 'line' ? 'lines+markers' : (plotType === 'scatter' ? 'markers' : undefined),
    });
  }

  if (normalized.hum) {
    traces.push({
      x: normalized.x.map(toDateIfIso),
      y: normalized.hum,
      name: 'Vlhkost',
      yaxis: 'y2',
      type: plotType === 'line' ? 'scatter' : plotType,
      mode: plotType === 'line' ? 'lines+markers' : (plotType === 'scatter' ? 'markers' : undefined),
    });
  }

  if (traces.length === 0) {
    plotRangeLabel.textContent = 'Žádné hodnoty pro graf';
    Plotly.purge(plotContainer);
    return;
  }

  const layout = {
    title: '',
    margin: { t: 40, l: 50, r: 60, b: 40 },
    xaxis: { title: 'Čas', type: 'date' },
    yaxis: { title: 'Teplota (°C)', side: 'left', showgrid: true, zeroline: false },
    yaxis2: { title: 'Vlhkost (%)', overlaying: 'y', side: 'right', showgrid: false },
    template: 'plotly_white',
  };

  const config = { responsive: true };

  Plotly.newPlot(plotContainer, traces, layout, config);

  // pokud existuje parent level, použijeme ho pro hezčí/zkrácené formátování
  const displayLevelForKey = parentLevel(params.level) || params.level || '';
  const keyText = params.key ? formatKeyForCzechDisplay(params.key, displayLevelForKey) : '';

  plotRangeLabel.textContent = '';
}

async function fetchAndPlot(params) {
  if (!params || !params.sensor_id || !params.level || !params.key) return;
  lastParams = params;

  if (!params.key) params.key = todayKey();

  const url = buildAggregateUrl(params);
  try {
    plotRangeLabel.textContent = 'Načítám...';
    const resp = await fetch(url, { cache: 'no-store' });
    const body = await resp.json();

    if (body && body.error) {
      plotRangeLabel.textContent = 'Chyba API: ' + (body.error || 'Unknown');
      Plotly.purge(plotContainer);
      console.error('Aggregate API returned error', body);
      return;
    }

    if (!resp.ok) {
      plotRangeLabel.textContent = 'Chyba API';
      Plotly.purge(plotContainer);
      console.error('HTTP error', resp.status, body);
      return;
    }

    const rows = body.result ?? body.data ?? body;
    const query = body.query ?? null;
    params.query = query;

    const normalized = normalizeRows(rows || []);
    const hasValues = (Array.isArray(normalized.x) && normalized.x.length > 0) &&
      (Array.isArray(normalized.temp) || Array.isArray(normalized.hum));

    if (!hasValues) {
      plotRangeLabel.textContent = 'Žádná data';
      Plotly.purge(plotContainer);
      return;
    }

    normalized.x = normalized.x.map(toDateIfIso);

    if (query) {
      params.start_iso = params.start_iso || query.start_iso || query.start_utc || null;
      params.end_iso = params.end_iso || query.end_iso || query.end_utc || null;
    }

    renderPlot(normalized, params);
  } catch (err) {
    plotRangeLabel.textContent = 'Chyba';
    Plotly.purge(plotContainer);
    console.error('fetchAndPlot error', err);
  }
}

// Nasloucháme custom eventu z table.js
window.addEventListener('history-range-changed', (ev) => {
  const d = ev.detail || {};
  if (!d.sensor_id) d.sensor_id = sensorSelect?.value || null;
  if (!d.level) d.level = d.level || 'hourly';
  if (!d.key) d.key = d.key || todayKey();
  fetchAndPlot(d);
});

// Tlačítko obnovit
plotRefreshBtn?.addEventListener('click', () => {
  if (lastParams) fetchAndPlot(lastParams);
  else {
    const sensor = sensorSelect?.value || 'DHT11_01';
    fetchAndPlot({
      sensor_id: sensor,
      level: 'hourly',
      key: todayKey(),
      tz: Intl?.DateTimeFormat().resolvedOptions().timeZone,
      tz_offset: new Date().getTimezoneOffset() * -1,
    });
  }
});

// Inicializace: po DOMContentLoaded pokud existuje vybraný sensor, načti výchozí (volitelné)
document.addEventListener('DOMContentLoaded', () => {
  const sensor = sensorSelect?.value;
  if (sensor) {
    fetchAndPlot({
      sensor_id: sensor,
      level: 'hourly',
      key: todayKey(),
      tz: Intl?.DateTimeFormat().resolvedOptions().timeZone,
      tz_offset: new Date().getTimezoneOffset() * -1,
    });
  }
});
