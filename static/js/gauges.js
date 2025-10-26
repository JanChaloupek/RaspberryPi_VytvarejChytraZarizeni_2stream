// gauges.js - gauge helpers (podpora min, max a value, robustní kontrola)

// vrátí barvu podle hodnoty v rozsahu [min, max]
function getColor(value, min = 0, max = 100) {
  const v = Number.isFinite(Number(value)) ? Number(value) : NaN;
  const lo = Number.isFinite(Number(min)) ? Number(min) : 0;
  const hi = Number.isFinite(Number(max)) ? Number(max) : 100;

  if (!Number.isFinite(v)) return '#9e9e9e'; // neznámá hodnota -> neutrální šedá

  if (hi === lo) {
    return v >= hi ? '#4caf50' : '#9e9e9e';
  }

  let ratio = (v - lo) / (hi - lo);
  ratio = Math.max(0, Math.min(1, ratio));

  if (ratio < 0.33) return '#4caf50';
  if (ratio < 0.66) return '#ffeb3b';
  return '#f44336';
}

// robustní nastavení semi-gauge arc podle hodnoty v rozsahu [min, max]
function safeSetArcAndLabels(id, value, max, min = 0) {
  const arc = document.getElementById(id);
  if (!arc) return;
  try {
    const len = (typeof arc.getTotalLength === 'function') ? arc.getTotalLength() : 0;
    if (!len) { setTimeout(() => safeSetArcAndLabels(id, value, max, min), 40); return; }

    const bg = arc.parentElement.querySelector('.gauge-bg');
    const computedBgWidth = bg ? getComputedStyle(bg).strokeWidth : null;
    if (computedBgWidth) {
      const px = parseFloat(computedBgWidth);
      if (!isNaN(px)) {
        arc.setAttribute('stroke-width', String(px));
        if (bg) bg.setAttribute('stroke-width', String(px));
      }
    }

    const v = Number.isFinite(Number(value)) ? Number(value) : 0;
    const lo = Number.isFinite(Number(min)) ? Number(min) : 0;
    const hi = Number.isFinite(Number(max)) ? Number(max) : 100;
    const range = (hi - lo) || 1;
    let pct = (v - lo) / range;
    pct = Math.max(0, Math.min(1, pct));

    const prevLineCap = getComputedStyle(arc).strokeLinecap || '';
    arc.style.strokeLinecap = 'butt';

    arc.setAttribute('stroke-dasharray', String(len));
    arc.setAttribute('stroke-dashoffset', String(len * (1 - pct)));
    arc.style.stroke = getColor(v, lo, hi);

    setTimeout(() => {
      arc.style.strokeLinecap = prevLineCap || 'round';
    }, 60);

    try {
      const startPt = arc.getPointAtLength(0);
      const endPt = arc.getPointAtLength(len);
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
    } catch (e) { /* safe ignore */ }
  } catch (err) {
    setTimeout(() => safeSetArcAndLabels(id, value, max, min), 60);
  }
}

// nastaví semi-gauge arc podle hodnoty v rozsahu [min, max]
// deleguje na safeSetArcAndLabels (robustní implementace)
function setSemiGaugeArc(id, value, max, min = 0) {
  // minimální normalizace typů pro konzistenci
  const v = Number.isFinite(Number(value)) ? Number(value) : 0;
  const hi = Number.isFinite(Number(max)) ? Number(max) : 100;
  const lo = Number.isFinite(Number(min)) ? Number(min) : 0;
  // delegate to robust renderer which will wait for SVG readiness
  safeSetArcAndLabels(id, v, hi, lo);
}
