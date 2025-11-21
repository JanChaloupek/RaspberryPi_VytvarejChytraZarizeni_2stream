// static/js/plot.traces.js
// Modul pro tvorbu trace objektů pro Plotly.
// ----------------------------------------------------
// Účel:
// - Generuje trace objekty pro hlavní datové série (teplota, vlhkost, rosný bod).
// - Přidává statistické čáry (min, max, průměr) jako horizontální linie.
// - Odděluje logiku tvorby trace od samotného vykreslování grafu.
//
// Závislosti:
// - plot.utils.js (funkce computeStats)
//
// Funkce:
// - makeHorizontalTrace(x, value, name, yaxis, color, dash)
//   → Vytvoří horizontální trace (scatter line) pro danou hodnotu.
//   → Parametry:
//      - x: pole hodnot na ose X (čas).
//      - value: hodnota, která se má vykreslit jako horizontální čára.
//      - name: název trace (např. "Teplota min").
//      - yaxis: osa Y, ke které trace patří ("y1" nebo "y2").
//      - color: barva čáry.
//      - dash: styl čáry ("dot" nebo "dash").
//   → Vrací objekt trace pro Plotly.
//
// - addSeries(traces, x, values, label, yaxis, mainColor, minColor, maxColor, avgColor)
//   → Přidá hlavní sérii a statistické čáry do pole traces.
//   → Parametry:
//      - traces: pole, do kterého se trace přidávají.
//      - x: pole hodnot na ose X.
//      - values: pole hodnot pro sérii.
//      - label: název série (např. "Teplota").
//      - yaxis: osa Y ("y1" nebo "y2").
//      - mainColor: barva hlavní série.
//      - minColor: barva čáry pro minimum.
//      - maxColor: barva čáry pro maximum.
//      - avgColor: barva čáry pro průměr.
//   → Přidá hlavní trace (lines+markers).
//   → Vypočítá statistiky (min, max, avg) pomocí computeStats().
//   → Přidá horizontální čáry pro min, max a průměr.
//
// ----------------------------------------------------

import { computeStats } from './plot.utils.js';

/**
 * makeHorizontalTrace()
 * ----------------------------------------------------
 * Vytvoří horizontální trace pro danou hodnotu.
 *
 * @param {Array<any>} x Pole hodnot na ose X
 * @param {number} value Hodnota pro horizontální čáru
 * @param {string} name Název trace
 * @param {string} yaxis Osa Y ("y1" nebo "y2")
 * @param {string} color Barva čáry
 * @param {string} [dash='dot'] Styl čáry ("dot" nebo "dash")
 * @returns {object} Trace objekt pro Plotly
 */
export function makeHorizontalTrace(x, value, name, yaxis, color, dash='dot') {
  return {
    x,
    y: Array(x.length).fill(value),
    name,
    yaxis,
    type: 'scatter',
    mode: 'lines',
    line: { dash, width: 1, color },
    hoverinfo: 'text',
    text: Array(x.length).fill(`${name}: ${value.toFixed(2)}`)
  };
}

/**
 * addSeries()
 * ----------------------------------------------------
 * Přidá hlavní sérii a statistické čáry (min, max, průměr) do pole traces.
 *
 * @param {Array<object>} traces Pole trace objektů
 * @param {Array<any>} x Pole hodnot na ose X
 * @param {Array<number>|null} values Pole hodnot pro sérii
 * @param {string} label Název série (např. "Teplota")
 * @param {string} yaxis Osa Y ("y1" nebo "y2")
 * @param {string} mainColor Barva hlavní série
 * @param {string} minColor Barva čáry pro minimum
 * @param {string} maxColor Barva čáry pro maximum
 * @param {string} avgColor Barva čáry pro průměr
 */
export function addSeries(traces, x, values, label, yaxis, mainColor, minColor, maxColor, avgColor) {
  if (!values) return;
  // Hlavní trace
  traces.push({
    x,
    y: values,
    name: label,
    yaxis,
    type: 'scatter',
    mode: 'lines+markers',
    line: { color: mainColor }
  });

  // Statistické čáry
  const { min, max, avg } = computeStats(values);
  if (min !== null) traces.push(makeHorizontalTrace(x, min, `${label} min`, yaxis, minColor));
  if (max !== null) traces.push(makeHorizontalTrace(x, max, `${label} max`, yaxis, maxColor));
  if (avg !== null) traces.push(makeHorizontalTrace(x, avg, `${label} průměr`, yaxis, avgColor, 'dash'));
}
