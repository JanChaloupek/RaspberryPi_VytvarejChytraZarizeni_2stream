// static/js/gauges.js
// Robustní semi-gauge renderer založený na starém fungujícím kódu.
// ----------------------------------------------------
// Účel:
// - Vykresluje polokruhový gauge pomocí SVG <path> elementů.
// - Nastavuje barvu, délku oblouku a popisky min/max.
// - Poskytuje hlavní API setGaugeValue() a pomocnou funkci setSemiGaugeArc().
// - Obsahuje retry mechanismus pro případy, kdy SVG ještě není připraveno.
//
// Závislosti:
// - Používá pouze nativní DOM API a SVG API.
//
// Funkce:
// - getColor(value, min, max)
//   → Určí barvu gauge podle hodnoty (zelená/žlutá/červená/šedá).
// - safeSetArcAndLabels(id, value, max, min, attempt)
//   → Bezpečně nastaví oblouk gauge a popisky min/max, s retry mechanismem.
// - setSemiGaugeArc(id, value, max, min)
//   → Veřejná funkce pro nastavení oblouku gauge (volá safeSetArcAndLabels).
// - setGaugeValue(arcId, valueId, value, min, max)
//   → Hlavní API pro nastavení gauge (text hodnoty, oblouk, min/max).
//
// ----------------------------------------------------

/**
 * getColor(value, min, max)
 * ---------------------------------
 * Určí barvu gauge podle hodnoty.
 * - Zelená (#4caf50), pokud je hodnota v dolní třetině rozsahu.
 * - Žlutá (#ffeb3b), pokud je hodnota ve střední třetině.
 * - Červená (#f44336), pokud je hodnota v horní třetině.
 * - Šedá (#9e9e9e), pokud hodnota není číslo.
 *
 * @param {number} value Hodnota gauge
 * @param {number} [min=0] Minimální hodnota
 * @param {number} [max=100] Maximální hodnota
 * @returns {string} Hex kód barvy
 */
function getColor(value, min = 0, max = 100) {
  const v = Number.isFinite(Number(value)) ? Number(value) : NaN;
  const lo = Number.isFinite(Number(min)) ? Number(min) : 0;
  const hi = Number.isFinite(Number(max)) ? Number(max) : 100;
  if (!Number.isFinite(v)) return '#9e9e9e';
  if (hi === lo) return v >= hi ? '#4caf50' : '#9e9e9e';
  let ratio = (v - lo) / (hi - lo);
  ratio = Math.max(0, Math.min(1, ratio));
  if (ratio < 0.33) return '#4caf50';
  if (ratio < 0.66) return '#ffeb3b';
  return '#f44336';
}

/**
 * safeSetArcAndLabels(id, value, max, min, attempt)
 * ---------------------------------
 * Bezpečně nastaví oblouk gauge a popisky min/max.
 * - Najde SVG <path> podle id.
 * - Získá celkovou délku oblouku (getTotalLength).
 * - Pokud délka není dostupná, zkusí znovu (retry s timeoutem).
 * - Nastaví stroke-dasharray a stroke-dashoffset podle procenta hodnoty.
 * - Nastaví barvu oblouku podle getColor().
 * - Dočasně změní strokeLinecap na 'butt' pro přesný výpočet, pak vrátí zpět.
 * - Umístí textové prvky min/max (id + '-min', id + '-max') na začátek/konec oblouku.
 * - Retry mechanismus: až 10 pokusů s krátkým zpožděním.
 *
 * @param {string} id ID SVG <path> elementu gauge
 * @param {number} value Hodnota gauge
 * @param {number} max Maximální hodnota
 * @param {number} [min=0] Minimální hodnota
 * @param {number} [attempt=0] Počet pokusů (pro retry mechanismus)
 */
function safeSetArcAndLabels(id, value, max, min = 0, attempt = 0) {
  const arc = document.getElementById(id);
  if (!arc) return;
  try {
    const lenFn = typeof arc.getTotalLength === 'function';
    const len = lenFn ? arc.getTotalLength() : 0;
    if (!len) {
      if (attempt < 10) setTimeout(() => safeSetArcAndLabels(id, value, max, min, attempt + 1), 40);
      return;
    }

    // synchronizace tloušťky čáry s pozadím gauge
    const bg = arc.parentElement ? arc.parentElement.querySelector('.gauge-bg') : null;
    if (bg) {
      const computedBgWidth = getComputedStyle(bg).strokeWidth;
      if (computedBgWidth) {
        const px = parseFloat(computedBgWidth);
        if (!isNaN(px)) {
          arc.setAttribute('stroke-width', String(px));
          bg.setAttribute('stroke-width', String(px));
        }
      }
    }

    const v = Number.isFinite(Number(value)) ? Number(value) : 0;
    const lo = Number.isFinite(Number(min)) ? Number(min) : 0;
    const hi = Number.isFinite(Number(max)) ? Number(max) : 100;
    const range = (hi - lo) || 1;
    let pct = (v - lo) / range;
    pct = Math.max(0, Math.min(1, pct));

    const prevLineCap = getComputedStyle(arc).strokeLinecap || '';
    try { arc.style.strokeLinecap = 'butt'; } catch(e){}

    arc.setAttribute('stroke-dasharray', String(len));
    arc.setAttribute('stroke-dashoffset', String(Math.round(len * (1 - pct))));
    arc.style.stroke = getColor(v, lo, hi);

    setTimeout(() => {
      try { arc.style.strokeLinecap = prevLineCap || 'round'; } catch(e){}
    }, 60);

    // nastavení pozice a textu min/max labelů
    try {
      const startPt = arc.getPointAtLength(0);
      const endPt = arc.getPointAtLength(Math.max(len - 0.1, 0));
      const minEl = document.getElementById(id + '-min');
      const maxEl = document.getElementById(id + '-max');
      if (minEl) {
        minEl.setAttribute('x', String(startPt.x));
        minEl.setAttribute('y', String(startPt.y + 6));
        minEl.textContent = String(lo);
      }
      if (maxEl) {
        maxEl.setAttribute('x', String(endPt.x));
        maxEl.setAttribute('y', String(endPt.y + 6));
        maxEl.textContent = String(hi);
      }
    } catch (e) { /* safe ignore positioning errors */ }
  } catch (err) {
    if (attempt < 10) setTimeout(() => safeSetArcAndLabels(id, value, max, min, attempt + 1), 60);
  }
}

/**
 * setSemiGaugeArc(id, value, max, min)
 * ---------------------------------
 * Veřejná funkce pro nastavení oblouku gauge.
 * - Normalizuje hodnoty (value, min, max).
 * - Volá safeSetArcAndLabels() pro vykreslení.
 *
 * @param {string} id ID SVG <path> elementu gauge
 * @param {number} value Hodnota gauge
 * @param {number} max Maximální hodnota
 * @param {number} [min=0] Minimální hodnota
 */
export function setSemiGaugeArc(id, value, max, min = 0) {
  const v = Number.isFinite(Number(value)) ? Number(value) : 0;
  const hi = Number.isFinite(Number(max)) ? Number(max) : 100;
  const lo = Number.isFinite(Number(min)) ? Number(min) : 0;
  safeSetArcAndLabels(id, v, hi, lo);
}

/**
 * setGaugeValue(arcId, valueId, value, min, max)
 * ---------------------------------
 * Hlavní API pro nastavení gauge.
 * - Najde element s hodnotou (valueId) a nastaví text.
 * - Pokud value není číslo, zobrazí '--' a resetuje oblouk.
 * - Pokud value je číslo, zobrazí hodnotu s jedním desetinným místem.
 * - Nastaví min/max labely (pokud existují).
 * - Volá setSemiGaugeArc() pro vykreslení oblouku.
 *
 * @param {string} arcId ID SVG <path> elementu gauge
 * @param {string} valueId ID elementu pro zobrazení hodnoty
 * @param {number|null} value Hodnota gauge
 * @param {number|null} [min=null] Minimální hodnota
 * @param {number|null} [max=null] Maximální hodnota
 */
export function setGaugeValue(arcId, valueId, value, min = null, max = null) {
  const valEl = document.getElementById(valueId);
  if (!valEl) {
    console.warn('[gauges] value element not found for', valueId);
    return;
  }

  // fallback pro nečíselné hodnoty
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    valEl.textContent = '--';
    const arc = document.getElementById(arcId);
    if (arc) {
      try {
        const len = arc.getTotalLength();
        arc.setAttribute('stroke-dasharray', String(len));
        arc.setAttribute('stroke-dashoffset', String(len));
      } catch (e) {
        arc.style.strokeDasharray = '';
        arc.style.strokeDashoffset = '';
      }
    }
    const minEl = document.getElementById(`${arcId}-min`);
    const maxEl = document.getElementById(`${arcId}-max`);
    if (minEl) minEl.textContent = (min === null || min === undefined) ? '--' : String(min);
    if (maxEl) maxEl.textContent = (max === null || max === undefined) ? '--' : String(max);
    return;
  }

  // validní hodnota
  const v = Number(value);
  valEl.textContent = v.toFixed(1);

  const lo = Number.isFinite(Number(min)) ? Number(min) : 0;
  const hi = Number.isFinite(Number(max)) ? Number(max) : 100;

  setSemiGaugeArc(arcId, v, hi, lo);
}
