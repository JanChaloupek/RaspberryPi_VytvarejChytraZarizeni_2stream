// static/js/plot.legend.js
// Modul pro tvorbu vlastní HTML legendy pod grafem.
// ----------------------------------------------------
// Účel:
// - Generuje vlastní HTML legendu pro grafy.
// - Každá položka legendy obsahuje barevnou čáru (SVG line) a textový popisek.
// - Podporuje různé styly čar (plná, tečkovaná, čárkovaná).
// - Odděluje logiku legendy od samotného vykreslování grafu.
//
// Závislosti:
// - Používá pouze nativní DOM API a SVG API.
// - Očekává objekt trace (např. z Plotly nebo jiného grafového rendereru).
//
// Funkce:
// - makeLegendItem(trace)
//   → Vytvoří jednu položku legendy.
//   → Parametry:
//      - trace.name: textový popisek položky.
//      - trace.line.color: barva čáry.
//      - trace.line.width: tloušťka čáry.
//      - trace.line.dash: styl čáry ("dot" nebo "dash").
//   → Vrací <div> obsahující SVG čáru a <span> s popiskem.
//
// ----------------------------------------------------

/**
 * makeLegendItem(trace)
 * ----------------------------------------------------
 * Vytvoří položku legendy pro daný trace.
 * - Vytvoří <div> s flex layoutem.
 * - Vloží SVG s čárou odpovídající stylu trace.
 * - Přidá textový popisek (trace.name).
 *
 * @param {object} trace Objekt s informacemi o trace (name, line.color, line.width, line.dash)
 * @returns {HTMLDivElement} Element legendy
 */
export function makeLegendItem(trace) {
  const item = document.createElement('div');
  item.className = 'd-flex align-items-center me-3';

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "10");

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", "0");
  line.setAttribute("y1", "5");
  line.setAttribute("x2", "20");
  line.setAttribute("y2", "5");
  line.setAttribute("stroke", trace.line?.color || '#000');
  line.setAttribute("stroke-width", trace.line?.width || 2);

  // Podpora stylů čáry (dot/dash)
  if (trace.line?.dash) {
    if (trace.line.dash === 'dot') line.setAttribute("stroke-dasharray", "2,2");
    else if (trace.line.dash === 'dash') line.setAttribute("stroke-dasharray", "6,4");
  }

  svg.appendChild(line);

  const label = document.createElement('span');
  label.textContent = trace.name;
  label.className = 'ms-1';

  item.appendChild(svg);
  item.appendChild(label);
  return item;
}
