// static/js/plot.js
// Entry point pro grafový modul.
// ----------------------------------------------------
// Účel:
// - Slouží jako hlavní vstupní bod pro grafový modul.
// - Načítá dílčí moduly (plot.events.js).
// - Spouští inicializaci událostí a grafu.
// - Samotná logika je delegována do initPlotEvents().
//
// Závislosti:
// - plot.events.js (funkce initPlotEvents)
//
// Funkce:
// - initPlotEvents()
//   → Připojí posluchače k UI prvkům a událostem.
//   → Naslouchá custom eventům a obsluhuje tlačítka.
//   → Inicializuje graf po načtení DOM.
//
// ----------------------------------------------------

import { initPlotEvents } from './plot.events.js';
import { fetchAndPlot } from './plot.api.js';

console.log('fetchAndPlot imported', fetchAndPlot);

/**
 * Spuštění inicializace událostí a grafu.
 * - Volá initPlotEvents() z modulu plot.events.js.
 * - Zajišťuje, že grafový modul je připraven k použití.
 */
initPlotEvents();
