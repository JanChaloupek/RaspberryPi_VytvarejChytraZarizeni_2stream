// static/js/plot.render.js
// Modul pro vykreslení grafu pomocí Plotly.
// ----------------------------------------------------
// Účel:
// - Připraví trace pro Teplotu, Vlhkost a Rosný bod.
// - Nastaví layout grafu (X = čas, Y1 = teplota, Y2 = vlhkost).
// - Vykreslí vlastní HTML legendu pod grafem.
// - Ověří dostupnost Plotly a zobrazí chybovou hlášku, pokud není načten.
// - Slouží jako renderer pro normalizovaná data z API.
//
// Závislosti:
// - plot.traces.js (funkce addSeries)
// - plot.legend.js (funkce makeLegendItem)
// - plot.events.js (funkce applyPlotType)
//
// Funkce:
// - ensurePlotlyOrShowError()
//   → Ověří dostupnost Plotly. Pokud chybí, nastaví hlášku a zaloguje chybu.
// - renderPlot(normalized, params)
//   → Vykreslí graf do #plot-container a připraví legendu do #plot-legend.
//   → normalized: { x, temp, hum, dew }
//   → params: volitelný objekt s metadaty (např. query).
//
// ----------------------------------------------------

import { addSeries } from './plot.traces.js';
import { makeLegendItem } from './plot.legend.js';
import { applyPlotType } from './plot.events.js';

/**
 * ensurePlotlyOrShowError()
 * ----------------------------------------------------
 * Ověří dostupnost Plotly. Pokud chybí, ukáže hlášku.
 *
 * @returns {boolean} true pokud je Plotly dostupný, jinak false
 */
function ensurePlotlyOrShowError() {
  const plotRangeLabel = document.getElementById('plot-range');
  if (typeof Plotly === 'undefined') {
    if (plotRangeLabel) plotRangeLabel.textContent = 'Plotly není načten';
    console.error('Plotly is not defined. Ensure Plotly CDN script is included before plot modules.');
    return false;
  }
  return true;
}

/**
 * renderPlot(normalized, params)
 * ----------------------------------------------------
 * Vykreslí graf do #plot-container a připraví legendu do #plot-legend.
 * - Připraví trace pro teplotu, vlhkost a rosný bod.
 * - Nastaví layout s osami a vzhledem.
 * - Vykreslí graf pomocí Plotly.newPlot().
 * - Vytvoří vlastní HTML legendu pod grafem.
 *
 * @param {{x:Array<any>, temp:Array<number>|null, hum:Array<number>|null, dew:Array<number>|null}} normalized Normalizovaná data
 * @param {object} [params={}] Volitelný objekt s metadaty
 * @returns {void}
 */
export function renderPlot(normalized, params = {}) {
  if (!ensurePlotlyOrShowError()) return;

  const plotContainer = document.getElementById('plot-container');
  const plotRangeLabel = document.getElementById('plot-range');
  if (!plotContainer) {
    console.warn('renderPlot: #plot-container nebyl nalezen');
    return;
  }

  const traces = [];
  const xAsDate = normalized.x;

  // Teplota (Y1)
  addSeries(traces, xAsDate, normalized.temp, 'Teplota',  'y1', '#ff0000', '#1f77b4', '#d62728', '#2ca02c');
  // Vlhkost (Y2)
  addSeries(traces, xAsDate, normalized.hum, 'Vlhkost',   'y2', '#0000ff', '#17becf', '#ff7f0e', '#9467bd');
  // Rosný bod (Y1)
  addSeries(traces, xAsDate, normalized.dew, 'Rosný bod', 'y1', '#8c564b', '#8c564b', '#8c564b', '#8c564b');

  if (!traces.length) {
    if (plotRangeLabel) plotRangeLabel.textContent = 'Žádné hodnoty pro graf';
    Plotly.purge(plotContainer);
    return;
  }

  const layout = {
    margin: { t: 40, l: 50, r: 60, b: 40 },
    xaxis: { title: 'Čas', type: 'date' },
    yaxis: { title: 'Teplota (°C)', side: 'left', showgrid: true, zeroline: false },
    yaxis2: { title: 'Vlhkost (%)', overlaying: 'y', side: 'right', showgrid: false },
    template: 'plotly_white',
    showlegend: false,
    hovermode: 'x unified'
  };
  const config = {
    responsive: true,
    displayModeBar: true,
    modeBarButtons: [
      ['zoom2d', 'pan2d', 'resetScale2d'],
      ['toImage']
    ]
  };

  Plotly.newPlot(plotContainer, traces, layout, config);

  // Vlastní legenda pod grafem
  const legendDiv = document.getElementById('plot-legend');
  if (legendDiv) {
    legendDiv.innerHTML = '';
    traces.forEach(trace => {
      if (trace.name) legendDiv.appendChild(makeLegendItem(trace));
    });
  }

  if (plotRangeLabel) plotRangeLabel.textContent = '';

  // Synchronizace typu grafu po každém vykreslení
  const plotTypeSelect = document.getElementById('plot-type');
  if (plotTypeSelect) {
    applyPlotType(plotTypeSelect.value);
  }
}
