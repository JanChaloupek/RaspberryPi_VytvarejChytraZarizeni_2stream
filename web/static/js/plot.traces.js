// static/js/plot.traces.js
// Modul pro tvorbu trace objektů pro Plotly.
// ----------------------------------------------------
// Účel:
// - Generuje trace objekty pro hlavní datové série (teplota, vlhkost, rosný bod).
// - Přidává statistické čáry (min, max, průměr) jako horizontální linie.
// - Odděluje logiku tvorby trace od samotného vykreslování grafu.
// - Přidány diagnostické logy.
// ----------------------------------------------------

import { computeStats } from './plot.utils.js';

/**
 * makeHorizontalTrace()
 * ----------------------------------------------------
 * Vytvoří horizontální trace pro danou hodnotu.
 */
export function makeHorizontalTrace(x, value, name, yaxis, color, dash='dot') {
//  console.log('[makeHorizontalTrace] creating', { name, value, yaxis, color, dash, xLength: x.length });
  return {
    x,
    y: Array(x.length).fill(value),
    name,
    yaxis,
    type: 'scatter',
    mode: 'lines',
    line: { dash, width: 1, color },
    hoverinfo: 'text',
    text: Array(x.length).fill(`${name}: ${value !== null && value !== undefined ? value.toFixed(2) : 'null'}`)
  };
}

/**
 * addSeries()
 * ----------------------------------------------------
 * Přidá hlavní sérii a statistické čáry (min, max, průměr) do pole traces.
 */
export function addSeries(traces, x, values, label, yaxis, mainColor, minColor, maxColor, avgColor) {
//  console.log('[addSeries] called', { label, yaxis, valuesLength: values ? values.length : null });

  if (!values || !Array.isArray(values) || values.length === 0) {
    console.warn(`[addSeries] no values for ${label}`, values);
    return;
  }

  // Hlavní trace
  const mainTrace = {
    x,
    y: values,
    name: label,
    yaxis,
    type: 'scatter',
    mode: 'lines+markers',
    line: { color: mainColor }
  };
  traces.push(mainTrace);
  console.log('[addSeries] main trace added', mainTrace);

  // Statistické čáry
  const { min, max, avg } = computeStats(values);
//  console.log('[addSeries] stats', { label, min, max, avg });

  if (min !== null) {
    const t = makeHorizontalTrace(x, min, `${label} min`, yaxis, minColor);
    traces.push(t);
//    console.log('[addSeries] min trace added', t);
  }
  if (max !== null) {
    const t = makeHorizontalTrace(x, max, `${label} max`, yaxis, maxColor);
    traces.push(t);
//    console.log('[addSeries] max trace added', t);
  }
  if (avg !== null) {
    const t = makeHorizontalTrace(x, avg, `${label} průměr`, yaxis, avgColor, 'dash');
    traces.push(t);
//    console.log('[addSeries] avg trace added', t);
  }
}
