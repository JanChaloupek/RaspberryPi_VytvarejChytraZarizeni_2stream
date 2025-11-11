// static/js/plot.events.js
// Modul pro obsluhu událostí a inicializaci grafu.
// ----------------------------------------------------
// Účel:
// - Naslouchá custom eventu 'history-range-changed' z table.js a reaguje načtením grafu.
// - Obsluhuje tlačítko "Obnovit" pro ruční refresh grafu.
// - Inicializuje graf po načtení DOM (DOMContentLoaded).
// - Udržuje stav posledních parametrů pro fetchAndPlot, aby bylo možné obnovit stejné vykreslení.
//
// Závislosti:
// - plot.api.js (funkce fetchAndPlot)
// - plot.utils.js (funkce todayKey)
//
// Funkce:
// - initPlotEvents()
//   → Připojí posluchače k UI prvkům a událostem.
//   → Naslouchá 'history-range-changed' a načítá graf.
//   → Obsluhuje tlačítko "Obnovit".
//   → Inicializuje graf po DOMContentLoaded.
// - lastParams (globální stav) → uchovává naposledy použité parametry pro fetchAndPlot.
//
// ----------------------------------------------------

import { fetchAndPlot } from './plot.api.js';
import { todayKey } from './plot.utils.js';

/**
 * applyPlotType()
 * ----------------------------------------------------
 * Přepne typ grafu podle hodnoty selectu.
 *
 * @param {string} type Hodnota z <select id="plot-type">
 */
export function applyPlotType(type) {
  if (type === 'line') {
    Plotly.restyle('plot-container', { type: 'scatter', mode: 'lines' });
  } else if (type === 'scatter') {
    Plotly.restyle('plot-container', { type: 'scatter', mode: 'markers' });
  } else if (type === 'bar') {
    Plotly.restyle('plot-container', { type: 'bar' });
  }
}

/**
 * Stav: naposledy použitý parametr pro fetchAndPlot,
 * aby šlo znovu obnovit stejné vykreslení.
 * @type {object|null}
 */
let lastParams = null;

/**
 * initPlotEvents()
 * ----------------------------------------------------
 * Připojí posluchače k UI prvkům a událostem, provede volitelnou inicializaci.
 * - Naslouchá custom eventu 'history-range-changed' z table.js.
 * - Obsluhuje tlačítko "Obnovit".
 * - Inicializuje graf po načtení DOM.
 */
export function initPlotEvents() {
  const plotRefreshBtn = document.getElementById('plot-refresh');
  const sensorSelect = document.getElementById('sensor_select');
  const plotRangeLabel = document.getElementById('plot-range');
  const plotTypeSelect = document.getElementById('plot-type');

  /**
   * Listener: history-range-changed
   * ----------------------------------------------------
   * Reaguje na custom event z table.js.
   * - Doplní chybějící parametry (sensor_id, level, key).
   * - Uloží parametry do lastParams.
   * - Nastaví label na "Načítám...".
   * - Zavolá fetchAndPlot() s parametry.
   */
  window.addEventListener('history-range-changed', (ev) => {
    const d = ev.detail || {};
    if (!d.sensor_id) d.sensor_id = sensorSelect?.value || null;
    if (!d.level) d.level = 'hourly';
    if (!d.key) d.key = todayKey();

    lastParams = d;
    if (plotRangeLabel) plotRangeLabel.textContent = 'Načítám...';
    fetchAndPlot(d).catch(err => {
      if (plotRangeLabel) plotRangeLabel.textContent = 'Chyba';
      console.error('history-range-changed -> fetchAndPlot error', err);
    });
  });

  /**
   * Listener: kliknutí na tlačítko "Obnovit"
   * ----------------------------------------------------
   * - Použije lastParams, pokud existují.
   * - Jinak sestaví výchozí parametry (aktuální senzor, hourly, todayKey).
   * - Nastaví label na "Načítám...".
   * - Zavolá fetchAndPlot() s parametry.
   */
  plotRefreshBtn?.addEventListener('click', () => {
    const params = lastParams || {
      sensor_id: sensorSelect?.value || 'DHT11_01',
      level: 'hourly',
      key: todayKey(),
      tz: Intl?.DateTimeFormat().resolvedOptions().timeZone,
      tz_offset: new Date().getTimezoneOffset() * -1,
    };
    lastParams = params;
    if (plotRangeLabel) plotRangeLabel.textContent = 'Načítám...';
    fetchAndPlot(params).catch(err => {
      if (plotRangeLabel) plotRangeLabel.textContent = 'Chyba';
      console.error('refresh click -> fetchAndPlot error', err);
    });
  });

  // Obsluha změny typu grafu
  plotTypeSelect?.addEventListener('change', (ev) => {
    const type = ev.target.value;
    if (type === 'line') {
      Plotly.restyle('plot-container', { type: 'scatter', mode: 'lines' });
    } else if (type === 'scatter') {
      Plotly.restyle('plot-container', { type: 'scatter', mode: 'markers' });
    } else if (type === 'bar') {
      Plotly.restyle('plot-container', { type: 'bar' });
    }
  });

  /**
   * Listener: DOMContentLoaded
   * ----------------------------------------------------
   * - Po načtení DOM zkontroluje, zda je vybraný senzor.
   * - Pokud ano, sestaví parametry a načte výchozí graf.
   * - Nastaví label na "Načítám...".
   * - Zavolá fetchAndPlot() s parametry.
   */
  document.addEventListener('DOMContentLoaded', () => {
    const sensor = sensorSelect?.value;
    if (sensor) {
      const params = {
        sensor_id: sensor,
        level: 'hourly',
        key: todayKey(),
        tz: Intl?.DateTimeFormat().resolvedOptions().timeZone,
        tz_offset: new Date().getTimezoneOffset() * -1,
      };
      lastParams = params;
      if (plotRangeLabel) plotRangeLabel.textContent = 'Načítám...';
      fetchAndPlot(params).catch(err => {
        if (plotRangeLabel) plotRangeLabel.textContent = 'Chyba';
        console.error('DOMContentLoaded -> fetchAndPlot error', err);
      });
    }
  });
}
