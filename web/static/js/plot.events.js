// static/js/plot.events.js
// Modul pro obsluhu událostí grafů.
// ----------------------------------------------------
// Účel:
// - Spravuje interakce uživatele s grafem (změna typu, překreslení, změna tématu).
// - Reaguje na události aplikace (history-range-changed) a zajišťuje načtení nových dat.
// - Inicializuje výchozí graf po načtení stránky.
// - Odděluje logiku událostí od logiky API a renderování.
//
// Závislosti:
// - plot.api.js (fetchAndPlot)
// - plot.render.js (renderPlot)
// - Knihovna Plotly (globální objekt)
//
// Exportované funkce:
// - applyPlotType(type)
//   → Změní typ grafu (scatter, bar, ...).
// - initPlotEvents()
//   → Inicializuje všechny posluchače událostí (DOMContentLoaded, history-range-changed,
//     změna typu grafu, změna tématu).
//
// Interní funkce:
// - rerenderPlots()
//   → Překreslí graf s uloženými daty (_meta).
//
// ----------------------------------------------------

import { fetchAndPlot } from './plot.api.js';
import { renderPlot } from './plot.render.js';

/**
 * applyPlotType()
 * ----------------------------------------------------
 * Změní typ grafu (např. scatter, bar).
 * - Používá Plotly.restyle() na #plot-container.
 * - Pokud Plotly nebo container chybí, zaloguje varování.
 *
 * @param {string} type - nový typ grafu
 */
export function applyPlotType(type) {
  const plotContainer = document.getElementById('plot-container');
  if (!plotContainer) {
    console.warn('[plot.events] applyPlotType: #plot-container nebyl nalezen');
    return;
  }
  if (typeof Plotly === 'undefined') {
    console.warn('[plot.events] applyPlotType: Plotly není načten');
    return;
  }
  console.info('[plot.events] applyPlotType', type);
  try {
    Plotly.restyle(plotContainer, { type });
  } catch (err) {
    console.error('[plot.events] applyPlotType error', err);
  }
}

/**
 * rerenderPlots()
 * ----------------------------------------------------
 * Překreslí graf s uloženými daty.
 * - Používá renderPlot() s normalized daty z _meta.
 * - Pokud data chybí, zaloguje varování.
 */
function rerenderPlots() {
  const plotContainer = document.getElementById('plot-container');
  if (!plotContainer) {
    console.warn('[plot.events] rerenderPlots: #plot-container nebyl nalezen');
    return;
  }

  if (!plotContainer._meta || !plotContainer._meta.normalized) {
    console.warn('[plot.events] rerenderPlots: žádná data k překreslení');
    return;
  }

  console.info('[plot.events] rerenderPlots triggered', plotContainer._meta);
  const { normalized, params } = plotContainer._meta;
  try {
    renderPlot(normalized, params);
  } catch (err) {
    console.error('[plot.events] rerenderPlots error', err);
  }
}

/**
 * initPlotEvents()
 * ----------------------------------------------------
 * Inicializuje události pro grafy.
 * - Načte defaultní graf po DOMContentLoaded.
 * - Reaguje na událost 'history-range-changed' → načte nový graf.
 * - Připojí listener na select #plot-type → mění typ grafu.
 * - Sleduje změnu tématu (data-bs-theme) → překreslí graf.
 */
export function initPlotEvents() {
  console.info('[plot.events] initPlotEvents called');

  // Listener na změnu rozsahu historie
  window.addEventListener('history-range-changed', e => {
    console.info('[plot.events] history-range-changed', e.detail);
    fetchAndPlot(e.detail);
  });

  // Listener na změnu typu grafu
  const plotTypeSelect = document.getElementById('plot-type');
  if (plotTypeSelect) {
    plotTypeSelect.addEventListener('change', e => {
      applyPlotType(e.target.value);
    });
  } else {
    console.warn('[plot.events] initPlotEvents: #plot-type nebyl nalezen');
  }

  // Observer pro změnu tématu (dark/light)
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.attributeName === 'data-bs-theme') {
        const theme = document.documentElement.getAttribute('data-bs-theme');
        console.info('[plot.events] Theme changed to', theme);
        rerenderPlots();
      }
    }
  });
  observer.observe(document.documentElement, { attributes: true });
}
