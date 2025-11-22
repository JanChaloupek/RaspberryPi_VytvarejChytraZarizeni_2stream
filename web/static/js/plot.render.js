// static/js/plot.render.js
// Modul pro vykreslení grafu pomocí Plotly.
// ----------------------------------------------------
// Účel:
// - Připraví trace pro Teplotu, Vlhkost a Rosný bod.
// - Nastaví layout grafu (X = čas, Y1 = teplota, Y2 = vlhkost).
// - Vykreslí vlastní HTML legendu pod grafem.
// - Ověří dostupnost Plotly a zobrazí chybovou hlášku, pokud není načten.
// - Slouží jako renderer pro normalizovaná data z API.
// - Ukládá metadata (_meta) do #plot-container pro pozdější překreslení.
//
// Závislosti:
// - plot.traces.js (funkce addSeries)
// - plot.legend.js (funkce makeLegendItem)
// - plot.events.js (funkce applyPlotType)
// - Knihovna Plotly (globální objekt)
//
// Exportované funkce:
// - renderPlot(normalized, params)
//   → vykreslí graf z normalizovaných dat a uloží metadata.
//
// Interní funkce:
// - ensurePlotlyOrShowError()
//   → ověří dostupnost Plotly, jinak zobrazí chybovou hlášku.
// - getCssVar(name, fallback)
//   → načte CSS proměnnou z :root, s fallbackem.
// ----------------------------------------------------

import { addSeries } from './plot.traces.js';
import { makeLegendItem } from './plot.legend.js';
import { applyPlotType } from './plot.events.js';

/**
 * Ověří dostupnost Plotly, jinak zobrazí chybovou hlášku.
 * @returns {boolean} true pokud je Plotly dostupné
 */
function ensurePlotlyOrShowError() {
  const plotRangeLabel = document.getElementById('plot-range');
  if (typeof Plotly === 'undefined') {
    if (plotRangeLabel) plotRangeLabel.textContent = 'Plotly není načten';
    console.error('[plot.render] Plotly is not defined. Ensure Plotly CDN script is included before plot modules.');
    return false;
  }
  return true;
}

/**
 * Načte CSS proměnnou z :root, s fallbackem.
 * @param {string} name - název CSS proměnné
 * @param {string} fallback - fallback hodnota
 * @returns {string} hodnota CSS proměnné nebo fallback
 */
function getCssVar(name, fallback = '#000') {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
}

/**
 * Vykreslí graf z normalizovaných dat.
 * - Připraví trace pro teplotu, vlhkost a rosný bod.
 * - Nastaví layout a config pro Plotly.
 * - Uloží metadata (_meta) do #plot-container.
 * - Vykreslí vlastní legendu.
 *
 * @param {object} normalized - normalizovaná data { x, temp, hum, dew }
 * @param {object} [params={}] - parametry volání (např. query)
 */
export function renderPlot(normalized, params = {}) {
//  console.info('[plot.render] renderPlot start', { normalized, params });

  if (!ensurePlotlyOrShowError()) return;

  const plotContainer = document.getElementById('plot-container');
  const plotRangeLabel = document.getElementById('plot-range');
  if (!plotContainer) {
    console.warn('[plot.render] #plot-container nebyl nalezen');
    return;
  }

  const traces = [];
  const xAsDate = normalized.x || [];

  addSeries(traces, xAsDate, normalized.temp, 'Teplota',  'y1', '#ff0000', '#1f77b4', '#d62728', '#2ca02c');
  addSeries(traces, xAsDate, normalized.hum, 'Vlhkost',   'y2', '#0000ff', '#17becf', '#ff7f0e', '#9467bd');
  addSeries(traces, xAsDate, normalized.dew, 'Rosný bod', 'y1', '#8c564b', '#8c564b', '#8c564b', '#8c564b');

//  console.info('[plot.render] traces prepared', { count: traces.length });

  if (!traces.length) {
    if (plotRangeLabel) plotRangeLabel.textContent = 'Žádné hodnoty pro graf';
    Plotly.purge(plotContainer);
    console.warn('[plot.render] žádné hodnoty – graf vyčištěn');
    return;
  }

  const layout = {
    margin: { t: 40, l: 50, r: 60, b: 40 },
    xaxis: { title: 'Čas', type: 'date', color: getCssVar('--plot-axis', '#000') },
    yaxis: { title: 'Teplota (°C)', side: 'left', showgrid: true, zeroline: false, color: getCssVar('--plot-axis', '#000') },
    yaxis2: { title: 'Vlhkost (%)', overlaying: 'y', side: 'right', showgrid: false, color: getCssVar('--plot-axis', '#000') },
    paper_bgcolor: getCssVar('--plot-bg', '#fff'),
    plot_bgcolor: getCssVar('--plot-area-bg', '#fff'),
    font: { color: getCssVar('--plot-text', '#000') },
    showlegend: false,
    hovermode: 'x unified'
  };

  const config = {
    responsive: true,
    displayModeBar: true,
    modeBarButtons: [['zoom2d', 'pan2d', 'resetScale2d'], ['toImage']]
  };

//  console.info('[plot.render] layout & config ready', { layout, config });

  Plotly.newPlot(plotContainer, traces, layout, config);

  // vlastní metadata ukládáme bokem
  plotContainer._meta = { normalized, params };
//  console.info('[plot.render] metadata uložená do plotContainer._meta', plotContainer._meta);

  const legendDiv = document.getElementById('plot-legend');
  if (legendDiv) {
    legendDiv.innerHTML = '';
    traces.forEach(trace => {
      if (trace.name) legendDiv.appendChild(makeLegendItem(trace));
    });
//    console.info('[plot.render] legenda vykreslena', { items: traces.map(t => t.name) });
  }

  if (plotRangeLabel) plotRangeLabel.textContent = '';

  const plotTypeSelect = document.getElementById('plot-type');
  if (plotTypeSelect) {
    applyPlotType(plotTypeSelect.value);
//    console.info('[plot.render] applyPlotType called', plotTypeSelect.value);
  }
}
